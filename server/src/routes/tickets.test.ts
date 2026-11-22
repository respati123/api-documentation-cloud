import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'

type Body = Record<string, any>

// The HTTP side of tickets. The rules are covered in services/tickets.test.ts.
describe.skipIf(!databaseEnabled)('ticket routes', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>
  let owner: TestAccount
  let base: string

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
    owner = await http.signUp('tk-owner')
    const workspaceId = await http.createWorkspace(owner, 'Tickets')
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
    const projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
    base = `/api/workspaces/${workspaceId}/projects/${projectId}`
  })

  afterAll(async () => {
    await db.close()
  })

  const call = (method: string, path: string, body?: unknown) => http.call(method, `${base}${path}`, { token: owner.token, body })
  const data = (response: { json: Record<string, unknown> }) => response.json.data as Body

  test('write a ticket, read its readiness, open it by its code and search for it', async () => {
    const epic = data(await call('POST', '/issues', { type: 'epic', title: 'Sign in', featurePrefix: 'AUTH' })).issue as Body
    const task = data(await call('POST', '/issues', { type: 'task', title: 'Endpoint', parentId: epic.id })).issue as Body

    const saved = await call('PUT', `/issues/${task.key}/ticket`, { role: 'backend', goal: 'Sign in works.', size: 'M' })
    expect(saved.status).toBe(200)
    expect(data(saved).ticket.issue).toMatchObject({ ticketCode: 'AUTH-001-BE-1', points: 3, role: 'backend' })
    expect(data(saved).ticket.readiness.ready).toBe(false)

    const readiness = data(await call('GET', '/issues/AUTH-001-BE-1/readiness')).readiness
    expect(readiness.failing.map((miss: Body) => miss.item)).toContain(3)

    const search = data(await call('GET', '/issues?q=auth-001-be-1'))
    expect((search.issues as Body[]).map((issue) => issue.id)).toEqual([task.id])
  })

  test('a bad field keeps the shared error shape', async () => {
    const epic = data(await call('POST', '/issues', { type: 'epic', title: 'Budgets', featurePrefix: 'BUDG' })).issue as Body
    const task = data(await call('POST', '/issues', { type: 'task', title: 'Budget API', parentId: epic.id })).issue as Body
    const bad = await call('PUT', `/issues/${task.key}/ticket`, { size: 'XL' })
    expect(bad.status).toBe(400)
    expect((await call('PUT', `/issues/${task.key}/ticket`, { requiredTests: [{ case: 'x' }] })).json.code).toBe('ISSUE_INPUT_INVALID')
  })
  test('the tickets of an epic come with readiness, dependencies and the load of each member', async () => {
    const epic = data(await call('POST', '/issues', { type: 'epic', title: 'Payments', featurePrefix: 'PAY' })).issue as Body
    const first = data(await call('POST', '/issues', { type: 'task', title: 'Charge API', parentId: epic.id, assigneeId: owner.user.id })).issue as Body
    const second = data(await call('POST', '/issues', { type: 'task', title: 'Charge screen', parentId: epic.id })).issue as Body
    await call('PUT', `/issues/${first.key}/ticket`, { role: 'backend', size: 'M' })
    await call('PUT', `/issues/${second.key}/ticket`, { role: 'frontend', size: 'S' })
    await call('POST', `/issues/${first.key}/links`, { toId: second.id, kind: 'blocks' })

    const listed = await call('GET', '/issues/PAY-001/tickets')
    expect(listed.status).toBe(200)
    const tickets = data(listed).tickets as Body[]
    expect(tickets.map((ticket) => ticket.issue.ticketCode)).toEqual(['PAY-001-BE-1', 'PAY-001-FE-1'])
    expect(tickets[1].dependsOn).toEqual([first.id])
    expect(tickets[0].readiness.ready).toBe(false)
    expect(data(listed).load).toContainEqual({ userId: owner.user.id, points: 3, count: 1 })

    // A task is not an epic.
    expect((await call('GET', `/issues/${first.key}/tickets`)).json.code).toBe('ISSUE_NOT_FOUND')
  })
})
