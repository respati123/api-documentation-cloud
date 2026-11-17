import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { createApp } from '@/app'
import { loadConfig } from '@/config'
import { createAppContext } from '@/context'
import { createLogger } from '@/lib/logger'
import { seedAdmin } from '@/services/admin'

export const testPassword = 'correct-horse-1'

export type TestAccount = { token: string; user: { id: string; email: string } }

// Builds the real app over the test database, with mail off, and the HTTP helpers route tests share.
export function createTestHttp(db: SQL, databaseUrl: string) {
  const base = loadConfig({ ...process.env, DATABASE_URL: databaseUrl })
  const config = { ...base, smtp: { ...base.smtp, host: undefined } }
  const logger = createLogger({ level: 'error', service: 'api', version: 'test', sink: () => undefined })
  const app = createApp(createAppContext({ db, config, logger }))

  async function call(method: string, path: string, { token, body }: { token?: string; body?: unknown } = {}) {
    const response = await app.fetch(
      new Request(`http://api.test${path}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'CF-Connecting-IP': `test-${randomUUID()}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
    if (!response) throw new Error('The route did not answer.')
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return { status: response.status, json, headers: response.headers }
  }

  async function signUp(label: string): Promise<TestAccount> {
    const email = `${label}-${randomUUID()}@test.dev`
    const response = await call('POST', '/api/auth/register', { body: { email, password: testPassword } })
    return response.json.data as TestAccount
  }

  async function createWorkspace(owner: TestAccount, name: string): Promise<string> {
    const response = await call('POST', '/api/workspaces', { token: owner.token, body: { name, tree: [], variables: { globals: [], environments: [] } } })
    return (response.json.data as { workspace: { id: string } }).workspace.id
  }

  async function inviteAndAccept(owner: TestAccount, workspaceId: string, invitee: TestAccount, role: 'editor' | 'viewer') {
    const invited = await call('POST', `/api/workspaces/${workspaceId}/invites`, { token: owner.token, body: { email: invitee.user.email, role } })
    const inviteToken = (invited.json.data as { token: string }).token
    return call('POST', '/api/invites/accept', { token: invitee.token, body: { token: inviteToken } })
  }

  async function signInAdmin(): Promise<TestAccount> {
    const email = `admin-${randomUUID()}@test.dev`
    await seedAdmin(db, { email, password: testPassword })
    const response = await call('POST', '/api/auth/login', { body: { email, password: testPassword } })
    return response.json.data as TestAccount
  }

  async function mcp(secret: string, method: string, params?: unknown) {
    const response = await app.fetch(
      new Request('http://api.test/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}`, 'CF-Connecting-IP': `test-${randomUUID()}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      }),
    )
    if (!response) throw new Error('The route did not answer.')
    return { status: response.status, json: (await response.json().catch(() => ({}))) as Record<string, unknown> }
  }

  // A raw MCP post: any body (a notification has no id), any extra headers, and no key when secret is undefined.
  async function mcpRaw(secret: string | undefined, body: unknown, headers: Record<string, string> = {}) {
    const response = await app.fetch(
      new Request('http://api.test/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(secret ? { Authorization: `Bearer ${secret}` } : {}), 'CF-Connecting-IP': `test-${randomUUID()}`, ...headers },
        body: JSON.stringify(body),
      }),
    )
    if (!response) throw new Error('The route did not answer.')
    const text = await response.text()
    return { status: response.status, text, json: (text ? JSON.parse(text) : {}) as Record<string, unknown>, headers: response.headers }
  }

  return { call, signUp, createWorkspace, inviteAndAccept, signInAdmin, mcp, mcpRaw }
}
