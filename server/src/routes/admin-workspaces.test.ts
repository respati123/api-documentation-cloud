import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'

type AdminWorkspace = { id: string; name: string; ownerEmail: string; memberCount: number; createdAt: string }

describe.skipIf(!databaseEnabled)('admin workspace overview', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>
  let admin: TestAccount

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
    admin = await http.signInAdmin()
  })

  afterAll(async () => {
    await db.close()
  })

  function list(token: string, query = '') {
    return http.call('GET', `/api/admin/workspaces${query}`, { token })
  }

  test('an ordinary account cannot list every workspace', async () => {
    const member = await http.signUp('overview-not-admin')

    const response = await list(member.token)

    expect(response.status).toBe(403)
    expect(response.json.code).toBe('ADMIN_REQUIRED')
  })

  test('the admin sees workspaces they are not a member of, with owner and member count only', async () => {
    const owner = await http.signUp('overview-owner')
    const name = `Overview ${crypto.randomUUID()}`
    const workspaceId = await http.createWorkspace(owner, name)

    const response = await list(admin.token, `?q=${encodeURIComponent(name)}`)

    expect(response.status).toBe(200)
    const workspaces = (response.json.data as { workspaces: AdminWorkspace[] }).workspaces
    expect(workspaces).toHaveLength(1)
    expect(workspaces[0]).toMatchObject({ id: workspaceId, name, ownerEmail: owner.user.email, memberCount: 1 })
    expect(Object.keys(workspaces[0]).sort()).toEqual(['createdAt', 'id', 'memberCount', 'name', 'ownerEmail'])
  })

  test('the admin reads a workspace they are not a member of as a viewer, flagged as an admin view', async () => {
    const owner = await http.signUp('overview-read')
    const workspaceId = await http.createWorkspace(owner, 'Overview Read')

    const pull = await http.call('GET', `/api/workspaces/${workspaceId}/sync/pull`, { token: admin.token })
    const members = await http.call('GET', `/api/workspaces/${workspaceId}/members`, { token: admin.token })
    const history = await http.call('GET', `/api/workspaces/${workspaceId}/sync/history`, { token: admin.token })
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: admin.token })
    const documents = await http.call('GET', `/api/workspaces/${workspaceId}/planning/documents`, { token: admin.token })

    expect(pull.status).toBe(200)
    expect((pull.json.data as { workspace: unknown }).workspace).toMatchObject({ id: workspaceId, name: 'Overview Read', role: 'viewer', adminView: true })
    expect((members.json.data as { members: Array<{ id: string }> }).members.map((member) => member.id)).toEqual([owner.user.id])
    expect(history.status).toBe(200)
    expect(projects.status).toBe(200)
    expect(documents.json.data).toMatchObject({ canManage: false, canApprove: false, canReadDocuments: true })
  })

  test('a member pull is not flagged as an admin view', async () => {
    const owner = await http.signUp('overview-member')
    const workspaceId = await http.createWorkspace(owner, 'Overview Member')

    const pull = await http.call('GET', `/api/workspaces/${workspaceId}/sync/pull`, { token: owner.token })

    expect((pull.json.data as { workspace: unknown }).workspace).toMatchObject({ role: 'owner', adminView: false })
  })

  test('the admin cannot change a workspace they are not a member of', async () => {
    const owner = await http.signUp('overview-write')
    const workspaceId = await http.createWorkspace(owner, 'Overview Write')

    const rename = await http.call('PATCH', `/api/workspaces/${workspaceId}`, { token: admin.token, body: { name: 'Taken' } })
    const invite = await http.call('POST', `/api/workspaces/${workspaceId}/invites`, { token: admin.token, body: { email: 'x@test.dev', role: 'editor' } })
    const remove = await http.call('DELETE', `/api/workspaces/${workspaceId}/members/${owner.user.id}`, { token: admin.token })
    const comment = await http.call('POST', `/api/workspaces/${workspaceId}/planning/document/any/comments`, { token: admin.token, body: { body: 'hi' } })

    for (const response of [rename, invite, remove, comment]) {
      expect(response.status).toBe(403)
      expect(response.json.code).toBe('ROLE_NOT_ALLOWED')
    }
    const pull = await http.call('GET', `/api/workspaces/${workspaceId}/sync/pull`, { token: owner.token })
    expect((pull.json.data as { workspace: { name: string } }).workspace.name).toBe('Overview Write')
  })

  test('an ordinary account still gets not found for a workspace it is not a member of', async () => {
    const owner = await http.signUp('overview-stranger-owner')
    const stranger = await http.signUp('overview-stranger')
    const workspaceId = await http.createWorkspace(owner, 'Overview Stranger')

    const read = await http.call('GET', `/api/workspaces/${workspaceId}/sync/pull`, { token: stranger.token })
    const write = await http.call('PATCH', `/api/workspaces/${workspaceId}`, { token: stranger.token, body: { name: 'Taken' } })

    expect(read.json.code).toBe('WORKSPACE_NOT_FOUND')
    expect(write.json.code).toBe('WORKSPACE_NOT_FOUND')
  })

  test('the admin gets not found for a workspace that does not exist', async () => {
    const response = await http.call('GET', `/api/workspaces/${crypto.randomUUID()}/sync/pull`, { token: admin.token })

    expect(response.json.code).toBe('WORKSPACE_NOT_FOUND')
  })

  test('the list searches by owner email and pages with a cursor', async () => {
    const owner = await http.signUp('overview-pager')
    await http.createWorkspace(owner, 'Pager One')
    await http.createWorkspace(owner, 'Pager Two')

    const first = await list(admin.token, `?limit=1&q=${encodeURIComponent(owner.user.email)}`)
    const firstNames = (first.json.data as { workspaces: AdminWorkspace[] }).workspaces.map((row) => row.name)
    const cursor = (first.json.meta as { nextCursor: string | null }).nextCursor
    expect(firstNames).toHaveLength(1)
    expect(cursor).not.toBeNull()

    const second = await list(admin.token, `?limit=1&q=${encodeURIComponent(owner.user.email)}&cursor=${cursor}`)
    const secondNames = (second.json.data as { workspaces: AdminWorkspace[] }).workspaces.map((row) => row.name)
    expect([...firstNames, ...secondNames].sort()).toEqual(['Pager One', 'Pager Two'])
    expect((second.json.meta as { nextCursor: string | null }).nextCursor).toBeNull()
  })
})
