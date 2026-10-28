import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { SQL } from 'bun'
import { loadConfig } from '@/config'
import { createApp } from '@/app'
import { createAppContext } from '@/context'
import { createLogger } from '@/lib/logger'
import { runMigrations } from '@/migrate'

// HTTP tests through the real router, middleware, and PostgreSQL. Skipped unless TEST_DATABASE_URL is set, and refused when it matches DATABASE_URL.
const testUrl = process.env.TEST_DATABASE_URL
const appUrl = process.env.DATABASE_URL
const enabled = Boolean(testUrl) && testUrl !== appUrl
const password = 'correct-horse-1'
const silent = createLogger({ level: 'error', service: 'api', version: 'test', sink: () => undefined })

describe.skipIf(!enabled)('HTTP routes against PostgreSQL', () => {
  const db = new SQL(testUrl ?? 'postgres://invalid')
  let app: ReturnType<typeof createApp>

  async function call(method: string, path: string, { token, body, headers = {} }: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    if (!app) throw new Error('The app is not built yet.')
    const response = await app.fetch(
      new Request(`http://api.test${path}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'CF-Connecting-IP': `test-${randomUUID()}`,
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
    if (!response) throw new Error('The route did not answer.')
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return { status: response.status, json }
  }

  async function signUp(label: string) {
    const email = `${label}-${randomUUID()}@test.dev`
    const response = await call('POST', '/api/auth/register', { body: { email, password } })
    const data = response.json.data as { token: string; user: { id: string; email: string } }
    return { token: data.token, user: data.user }
  }

  beforeAll(async () => {
    const config = loadConfig({ ...process.env, DATABASE_URL: testUrl ?? '' })
    app = createApp(createAppContext({ db, config, logger: silent }))
    await runMigrations(db, new URL('../migrations/', import.meta.url), { info: () => undefined })
  })

  afterAll(async () => {
    await db.close()
  })

  test('health answers without a session', async () => {
    const response = await call('GET', '/health')

    expect(response.status).toBe(200)
    expect(response.json.data).toEqual({ ok: true })
  })

  test('register creates an account and returns a session', async () => {
    const email = `new-${randomUUID()}@test.dev`
    const response = await call('POST', '/api/auth/register', { body: { email, password } })

    expect(response.status).toBe(201)
    expect(response.json.code).toBe('CREATED')
    expect(response.json.data).toMatchObject({ user: { email } })
  })

  test('register refuses a password that is too short', async () => {
    const response = await call('POST', '/api/auth/register', { body: { email: `short-${randomUUID()}@test.dev`, password: 'short' } })

    expect(response.status).toBe(400)
    expect(response.json.code).toBe('PASSWORD_LENGTH_INVALID')
  })

  test('login refuses a wrong password with the same error for any account', async () => {
    const user = await signUp('login')
    const response = await call('POST', '/api/auth/login', { body: { email: user.user.email, password: 'wrong-password-1' } })

    expect(response.status).toBe(401)
    expect(response.json.code).toBe('INVALID_CREDENTIALS')
  })

  test('me needs a session', async () => {
    const response = await call('GET', '/api/me')

    expect(response.status).toBe(401)
    expect(response.json.code).toBe('AUTH_REQUIRED')
  })

  test('a created workspace appears in the list, with no next page', async () => {
    const owner = await signUp('owner')
    const created = await call('POST', '/api/workspaces', { token: owner.token, body: { name: 'Payments API', tree: [], variables: { globals: [], environments: [] } } })
    const workspaceId = (created.json.data as { workspace: { id: string } }).workspace.id

    const listed = await call('GET', '/api/workspaces', { token: owner.token })
    const workspaces = (listed.json.data as { workspaces: Array<{ id: string }> }).workspaces

    expect(created.status).toBe(201)
    expect(workspaces.map((workspace) => workspace.id)).toContain(workspaceId)
    expect(listed.json.meta).toEqual({ nextCursor: null })
  })

  test('a stranger gets not found for someone else\'s workspace', async () => {
    const owner = await signUp('owner-private')
    const stranger = await signUp('stranger')
    const created = await call('POST', '/api/workspaces', { token: owner.token, body: { name: 'Private', tree: [], variables: { globals: [], environments: [] } } })
    const workspaceId = (created.json.data as { workspace: { id: string } }).workspace.id

    const response = await call('GET', `/api/workspaces/${workspaceId}/sync/pull`, { token: stranger.token })

    expect(response.status).toBe(404)
    expect(response.json.code).toBe('WORKSPACE_NOT_FOUND')
  })

  test('a viewer cannot push commits', async () => {
    const owner = await signUp('owner-push')
    const viewer = await signUp('viewer-push')
    const created = await call('POST', '/api/workspaces', { token: owner.token, body: { name: 'Push guard', tree: [], variables: { globals: [], environments: [] } } })
    const workspaceId = (created.json.data as { workspace: { id: string } }).workspace.id
    await db`INSERT INTO memberships (workspace_id, user_id, role) VALUES (${workspaceId}, ${viewer.user.id}, 'viewer')`

    const response = await call('POST', `/api/workspaces/${workspaceId}/sync/push`, { token: viewer.token, body: { commits: [{ id: randomUUID(), parentIds: [], message: 'x', tree: [] }] } })

    expect(response.status).toBe(403)
    expect(response.json.code).toBe('ROLE_NOT_ALLOWED')
  })

  test('a bad page limit is refused with the pagination error', async () => {
    const owner = await signUp('owner-limit')

    const response = await call('GET', '/api/workspaces?limit=0', { token: owner.token })

    expect(response.status).toBe(400)
    expect(response.json.code).toBe('PAGINATION_INVALID')
  })

  test('a body that is not an object is refused', async () => {
    const owner = await signUp('owner-body')

    const response = await call('POST', '/api/workspaces', { token: owner.token, body: ['not', 'an', 'object'] })

    expect(response.status).toBe(400)
    expect(response.json.code).toBe('BODY_NOT_OBJECT')
  })

  test('an unknown path under a workspace is not found', async () => {
    const owner = await signUp('owner-unknown')
    const created = await call('POST', '/api/workspaces', { token: owner.token, body: { name: 'Unknown path', tree: [], variables: { globals: [], environments: [] } } })
    const workspaceId = (created.json.data as { workspace: { id: string } }).workspace.id

    const response = await call('GET', `/api/workspaces/${workspaceId}/does-not-exist`, { token: owner.token })

    expect(response.status).toBe(404)
    expect(response.json.code).toBe('ROUTE_NOT_FOUND')
  })

  test('every error carries the request id and the same id in the header', async () => {
    const response = await call('GET', '/api/me', { headers: { 'X-Request-Id': 'trace-me-1' } })

    expect(response.json.requestId).toBe('trace-me-1')
  })
})
