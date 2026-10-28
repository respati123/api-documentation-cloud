import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { SQL } from 'bun'
import { loadConfig } from '@/config'
import { createApp } from '@/app'
import { createAppContext } from '@/context'
import { createLogger } from '@/lib/logger'
import { runMigrations } from '@/migrate'
import type { AppContext } from '@/context'
import { insertReset } from '@/repositories/password-resets.repository'
import { tokenHash } from '@/services/auth'

// HTTP tests through the real router, middleware, and PostgreSQL. Skipped unless TEST_DATABASE_URL is set, and refused when it matches DATABASE_URL.
const testUrl = process.env.TEST_DATABASE_URL
const appUrl = process.env.DATABASE_URL
const enabled = Boolean(testUrl) && testUrl !== appUrl
const password = 'correct-horse-1'
const silent = createLogger({ level: 'error', service: 'api', version: 'test', sink: () => undefined })

describe.skipIf(!enabled)('HTTP routes against PostgreSQL', () => {
  const db = new SQL(testUrl ?? 'postgres://invalid')
  let app: ReturnType<typeof createApp>
  let ctx: AppContext

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
    ctx = createAppContext({ db, config, logger: silent })
    app = createApp(ctx)
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

  test('the workspace list reports how many workspaces the user has and owns', async () => {
    const owner = await signUp('owner-counts')
    const other = await signUp('other-counts')
    await createWorkspace(owner, 'Counted one')
    await createWorkspace(owner, 'Counted two')
    const shared = await createWorkspace(other, 'Shared with owner')
    await inviteAndAccept(other, shared.workspaceId, owner, 'viewer')

    const listed = await call('GET', '/api/workspaces?limit=1', { token: owner.token })

    expect((listed.json.data as { counts: { total: number; owned: number } }).counts).toEqual({ total: 3, owned: 2 })
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

  async function createWorkspace(owner: { token: string }, name: string) {
    const response = await call('POST', '/api/workspaces', { token: owner.token, body: { name, tree: [], variables: { globals: [], environments: [] } } })
    const workspace = (response.json.data as { workspace: { id: string } }).workspace
    const pulled = await call('GET', `/api/workspaces/${workspace.id}/sync/pull`, { token: owner.token })
    const headCommitId = (pulled.json.data as { workspace: { headCommitId: string } }).workspace.headCommitId
    return { workspaceId: workspace.id, headCommitId }
  }

  async function pushCommit(owner: { token: string }, workspaceId: string, parentIds: string[], message: string) {
    const id = randomUUID()
    const response = await call('POST', `/api/workspaces/${workspaceId}/sync/push`, {
      token: owner.token,
      body: { commits: [{ id, parentIds, message, tree: [] }] },
    })
    return { id, status: response.status, json: response.json }
  }

  async function inviteAndAccept(owner: { token: string }, workspaceId: string, invitee: { token: string; user: { email: string } }, role: 'editor' | 'viewer') {
    const invited = await call('POST', `/api/workspaces/${workspaceId}/invites`, { token: owner.token, body: { email: invitee.user.email, role } })
    const inviteToken = (invited.json.data as { token: string }).token
    return call('POST', '/api/invites/accept', { token: invitee.token, body: { token: inviteToken } })
  }

  test('restore adds a new head that copies an earlier version, and refuses the current head', async () => {
    const owner = await signUp('owner-restore')
    const { workspaceId, headCommitId: first } = await createWorkspace(owner, 'Restore flow')
    const later = await pushCommit(owner, workspaceId, [first], 'later')

    const restored = await call('POST', `/api/workspaces/${workspaceId}/sync/restore/${first}`, { token: owner.token })
    const restoredHead = (restored.json.data as { headCommitId: string }).headCommitId
    const current = await call('POST', `/api/workspaces/${workspaceId}/sync/restore/${restoredHead}`, { token: owner.token })
    const missing = await call('POST', `/api/workspaces/${workspaceId}/sync/restore/${randomUUID()}`, { token: owner.token })

    expect(later.status).toBe(201)
    expect(restored.status).toBe(201)
    expect(restoredHead).not.toBe(later.id)
    expect(current.status).toBe(409)
    expect(current.json.code).toBe('VERSION_ALREADY_LATEST')
    expect(missing.status).toBe(404)
    expect(missing.json.code).toBe('COMMIT_NOT_FOUND')
  })

  test('a push that does not start from the head is a conflict that names the remote head', async () => {
    const owner = await signUp('owner-conflict')
    const { workspaceId, headCommitId: first } = await createWorkspace(owner, 'Conflict flow')
    const winner = await pushCommit(owner, workspaceId, [first], 'remote change')

    const stale = await pushCommit(owner, workspaceId, [first], 'local change')

    expect(winner.status).toBe(201)
    expect(stale.status).toBe(409)
    expect(stale.json.code).toBe('SYNC_REMOTE_ADVANCED')
    expect((stale.json.details as { remote: { id: string } }).remote.id).toBe(winner.id)
  })

  test('history pages newest first, and a commit can be read by id', async () => {
    const owner = await signUp('owner-history')
    const { workspaceId, headCommitId: first } = await createWorkspace(owner, 'History flow')
    const second = await pushCommit(owner, workspaceId, [first], 'second')
    const third = await pushCommit(owner, workspaceId, [second.id], 'third')

    const firstPage = await call('GET', `/api/workspaces/${workspaceId}/sync/history?limit=2`, { token: owner.token })
    const cursor = (firstPage.json.meta as { nextCursor: string }).nextCursor
    const secondPage = await call('GET', `/api/workspaces/${workspaceId}/sync/history?limit=2&cursor=${encodeURIComponent(cursor)}`, { token: owner.token })
    const detail = await call('GET', `/api/workspaces/${workspaceId}/sync/history/${third.id}`, { token: owner.token })
    const missing = await call('GET', `/api/workspaces/${workspaceId}/sync/history/${randomUUID()}`, { token: owner.token })

    const firstIds = (firstPage.json.data as { commits: Array<{ id: string }> }).commits.map((commit) => commit.id)
    const secondIds = (secondPage.json.data as { commits: Array<{ id: string }> }).commits.map((commit) => commit.id)
    expect(firstIds).toEqual([third.id, second.id])
    expect(secondIds).toEqual([first])
    expect((secondPage.json.meta as { nextCursor: string | null }).nextCursor).toBeNull()
    expect((detail.json.data as { commit: { id: string; message: string } }).commit).toMatchObject({ id: third.id, message: 'third' })
    expect(missing.status).toBe(404)
    expect(missing.json.code).toBe('COMMIT_NOT_FOUND')
  })

  test('an invite works for the invited email only, and only once', async () => {
    const owner = await signUp('owner-invite')
    const invitee = await signUp('invitee-invite')
    const stranger = await signUp('stranger-invite')
    const { workspaceId } = await createWorkspace(owner, 'Invite flow')

    const invited = await call('POST', `/api/workspaces/${workspaceId}/invites`, { token: owner.token, body: { email: invitee.user.email, role: 'editor' } })
    const inviteToken = (invited.json.data as { token: string; emailSent: boolean }).token
    const listed = await call('GET', `/api/workspaces/${workspaceId}/invites`, { token: owner.token })
    const wrongEmail = await call('POST', '/api/invites/accept', { token: stranger.token, body: { token: inviteToken } })
    const accepted = await call('POST', '/api/invites/accept', { token: invitee.token, body: { token: inviteToken } })
    const again = await call('POST', '/api/invites/accept', { token: invitee.token, body: { token: inviteToken } })
    const afterAccept = await call('GET', `/api/workspaces/${workspaceId}/invites`, { token: owner.token })

    expect(invited.status).toBe(201)
    expect((invited.json.data as { emailSent: boolean }).emailSent).toBe(false)
    expect((listed.json.data as { invites: Array<{ email: string }> }).invites.map((invite) => invite.email)).toEqual([invitee.user.email])
    expect(wrongEmail.status).toBe(403)
    expect(wrongEmail.json.code).toBe('INVITE_EMAIL_MISMATCH')
    expect(accepted.status).toBe(201)
    expect((accepted.json.data as { workspace: { role: string } }).workspace.role).toBe('editor')
    expect(again.status).toBe(410)
    expect(again.json.code).toBe('INVITE_INVALID')
    expect((afterAccept.json.data as { invites: unknown[] }).invites).toEqual([])
  })

  test('the owner can change a role, an owner cannot be demoted, and a member can leave', async () => {
    const owner = await signUp('owner-roles')
    const member = await signUp('member-roles')
    const { workspaceId } = await createWorkspace(owner, 'Roles flow')
    await inviteAndAccept(owner, workspaceId, member, 'editor')

    const promoted = await call('PATCH', `/api/workspaces/${workspaceId}/members/${member.user.id}`, { token: owner.token, body: { role: 'viewer' } })
    const demoteOwner = await call('PATCH', `/api/workspaces/${workspaceId}/members/${owner.user.id}`, { token: owner.token, body: { role: 'viewer' } })
    const leave = await call('DELETE', `/api/workspaces/${workspaceId}/members/${member.user.id}`, { token: member.token })
    const afterLeave = await call('GET', `/api/workspaces/${workspaceId}/sync/pull`, { token: member.token })

    expect(promoted.status).toBe(200)
    expect((promoted.json.data as { member: { role: string } }).member.role).toBe('viewer')
    expect(demoteOwner.status).toBe(403)
    expect(demoteOwner.json.code).toBe('OWNER_ROLE_IMMUTABLE')
    expect(leave.status).toBe(204)
    expect(afterLeave.status).toBe(404)
  })

  test('the members list starts with the owner and pages with a cursor', async () => {
    const owner = await signUp('owner-paging')
    const first = await signUp('first-paging')
    const second = await signUp('second-paging')
    const { workspaceId } = await createWorkspace(owner, 'Members paging')
    await inviteAndAccept(owner, workspaceId, first, 'editor')
    await inviteAndAccept(owner, workspaceId, second, 'viewer')

    const page1 = await call('GET', `/api/workspaces/${workspaceId}/members?limit=1`, { token: owner.token })
    const cursor = (page1.json.meta as { nextCursor: string }).nextCursor
    const page2 = await call('GET', `/api/workspaces/${workspaceId}/members?limit=2&cursor=${encodeURIComponent(cursor)}`, { token: owner.token })

    expect((page1.json.data as { members: Array<{ id: string; role: string }> }).members.map((member) => member.role)).toEqual(['owner'])
    expect((page2.json.data as { members: Array<{ id: string; role: string }> }).members.map((member) => member.id)).toEqual([first.user.id, second.user.id])
    expect((page2.json.meta as { nextCursor: string | null }).nextCursor).toBeNull()
  })

  test('a workspace is renamed freely, and deleted only when its exact name is typed back', async () => {
    const owner = await signUp('owner-rename')
    const { workspaceId } = await createWorkspace(owner, 'Old name')

    const renamed = await call('PATCH', `/api/workspaces/${workspaceId}`, { token: owner.token, body: { name: 'New name' } })
    const wrongName = await call('DELETE', `/api/workspaces/${workspaceId}`, { token: owner.token, body: { confirmName: 'Old name' } })
    const deleted = await call('DELETE', `/api/workspaces/${workspaceId}`, { token: owner.token, body: { confirmName: 'New name' } })
    const afterDelete = await call('GET', `/api/workspaces/${workspaceId}/sync/pull`, { token: owner.token })

    expect((renamed.json.data as { workspace: { name: string } }).workspace.name).toBe('New name')
    expect(wrongName.status).toBe(400)
    expect(wrongName.json.code).toBe('WORKSPACE_DELETE_CONFIRMATION_MISMATCH')
    expect(deleted.status).toBe(204)
    expect(afterDelete.status).toBe(404)
  })

  test('a password reset token works once, and ends every session of the account', async () => {
    const account = await signUp('account-reset')
    const rawToken = randomUUID()
    await insertReset(db, { tokenHash: tokenHash(rawToken), userId: account.user.id, expiresAt: new Date(Date.now() + 60 * 60_000) })

    const reset = await call('POST', '/api/auth/reset-password', { body: { token: rawToken, password: 'fresh-horse-2' } })
    const reused = await call('POST', '/api/auth/reset-password', { body: { token: rawToken, password: 'fresh-horse-3' } })
    const oldSession = await call('GET', '/api/me', { token: account.token })
    const login = await call('POST', '/api/auth/login', { body: { email: account.user.email, password: 'fresh-horse-2' } })

    expect(reset.status).toBe(204)
    expect(reused.status).toBe(400)
    expect(reused.json.code).toBe('RESET_TOKEN_INVALID')
    expect(oldSession.status).toBe(401)
    expect(login.status).toBe(200)
  })

  test('forgot-password gives the same answer for an unknown email', async () => {
    const response = await call('POST', '/api/auth/forgot-password', { body: { email: `nobody-${randomUUID()}@test.dev` } })

    expect(response.status).toBe(204)
  })

  test('a desktop login code works once', async () => {
    const account = await signUp('desktop-code')
    const code = randomUUID()
    ctx.desktopLoginCodes.set(tokenHash(code), { userId: account.user.id, expiresAt: Date.now() + 60_000 })

    const exchanged = await call('POST', '/api/desktop-login/exchange', { body: { code } })
    const reused = await call('POST', '/api/desktop-login/exchange', { body: { code } })

    expect(exchanged.status).toBe(200)
    expect((exchanged.json.data as { user: { id: string } }).user.id).toBe(account.user.id)
    expect(reused.status).toBe(400)
    expect(reused.json.code).toBe('DESKTOP_CODE_INVALID')
  })

  test('logout ends the session that made the request', async () => {
    const account = await signUp('logout')

    const loggedOut = await call('POST', '/api/auth/logout', { token: account.token })
    const after = await call('GET', '/api/me', { token: account.token })

    expect(loggedOut.status).toBe(204)
    expect(after.status).toBe(401)
    expect(after.json.code).toBe('SESSION_EXPIRED')
  })

  test('every error carries the request id and the same id in the header', async () => {
    const response = await call('GET', '/api/me', { headers: { 'X-Request-Id': 'trace-me-1' } })

    expect(response.json.requestId).toBe('trace-me-1')
  })
})
