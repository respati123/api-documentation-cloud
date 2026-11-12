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

  test('the admin still cannot open the content of a workspace they are not a member of', async () => {
    const owner = await http.signUp('overview-closed')
    const workspaceId = await http.createWorkspace(owner, 'Overview Closed')

    const response = await http.call('GET', `/api/workspaces/${workspaceId}`, { token: admin.token })

    expect(response.status).toBe(404)
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
