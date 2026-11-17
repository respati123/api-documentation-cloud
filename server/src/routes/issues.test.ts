import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'

type Body = Record<string, any>

describe.skipIf(!databaseEnabled)('issue, backlog, and sprint routes', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>
  let owner: TestAccount
  let pm: TestAccount
  let plain: TestAccount
  let viewer: TestAccount
  let stranger: TestAccount
  let workspaceId: string
  let base: string

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
    owner = await http.signUp('rt-owner')
    pm = await http.signUp('rt-pm')
    plain = await http.signUp('rt-plain')
    viewer = await http.signUp('rt-viewer')
    stranger = await http.signUp('rt-stranger')
    workspaceId = await http.createWorkspace(owner, 'Issue routes')
    await http.inviteAndAccept(owner, workspaceId, pm, 'editor')
    await http.inviteAndAccept(owner, workspaceId, plain, 'editor')
    await http.inviteAndAccept(owner, workspaceId, viewer, 'viewer')
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
    const projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
    base = `/api/workspaces/${workspaceId}/projects/${projectId}`
    await http.call('POST', `${base}/members`, { token: owner.token, body: { userId: pm.user.id, disciplines: ['pm'] } })
  })

  afterAll(async () => {
    await db.close()
  })

  const call = (method: string, path: string, who: TestAccount | null, body?: unknown) =>
    http.call(method, `${base}${path}`, { token: who?.token, body })
  const data = (response: { json: Record<string, unknown> }) => response.json.data as Body
  const makeTask = async (title: string, extra: Body = {}) => data(await call('POST', '/issues', pm, { type: 'task', title, points: 3, ...extra })).issue as Body

  test('a PM creates issues and reads them by id and by key, with the shared response shape', async () => {
    const response = await call('POST', '/issues', pm, { type: 'epic', title: 'Checkout' })
    expect(response.status).toBe(201)
    expect(response.json).toMatchObject({ code: 'CREATED', data: { issue: { type: 'epic', title: 'Checkout', status: null } } })
    expect(typeof response.json.requestId).toBe('string')
    const issue = data(response).issue as Body
    expect(issue.key).toMatch(/^[A-Z]{2,10}-\d+$/)
    expect(data(await call('GET', `/issues/${issue.id}`, pm)).issue.id).toBe(issue.id)
    expect(data(await call('GET', `/issues/${issue.key}`, pm)).issue.id).toBe(issue.id)
    // A new epic is a draft, so a member without a say does not see it yet.
    expect((await call('GET', `/issues/${issue.id}`, plain)).json.code).toBe('ISSUE_NOT_FOUND')
  })

  test('the issue list pages by number and hands out a cursor', async () => {
    const made = [await makeTask('page a'), await makeTask('page b'), await makeTask('page c')]
    const first = await call('GET', '/issues?type=task&limit=2', pm)
    expect(first.status).toBe(200)
    expect(data(first).issues).toHaveLength(2)

    // Following the cursor to the end gives every task once, in order of number.
    const seen: Body[] = []
    let path = '/issues?type=task&limit=2'
    for (let guard = 0; guard < 50; guard += 1) {
      const page = await call('GET', path, pm)
      seen.push(...data(page).issues)
      const next = (page.json.meta as { nextCursor: string | null }).nextCursor
      if (!next) break
      path = `/issues?type=task&limit=2&cursor=${next}`
    }
    const numbers = seen.map((issue) => issue.number as number)
    expect(numbers).toEqual([...numbers].sort((x, y) => x - y))
    expect(new Set(numbers).size).toBe(numbers.length)
    for (const task of made) expect(seen.some((issue) => issue.id === task.id)).toBe(true)

    expect((await call('GET', '/issues?limit=0', pm)).json.code).toBe('PAGINATION_INVALID')
    expect((await call('GET', '/issues?limit=101', pm)).json.code).toBe('PAGINATION_INVALID')
    expect((await call('GET', '/issues?cursor=nonsense', pm)).json.code).toBe('PAGINATION_INVALID')
  })

  test('a bad body is refused with the list of problems, and an unknown field is not ignored', async () => {
    const bad = await call('POST', '/issues', pm, { type: 'task', title: 'x', colour: 'red' })
    expect(bad.status).toBe(400)
    expect(bad.json).toMatchObject({ code: 'ISSUE_INPUT_INVALID' })
    expect(Array.isArray(bad.json.details)).toBe(true)
    expect((await call('POST', '/issues', pm, { type: 'saga', title: 'x' })).json.code).toBe('ISSUE_INPUT_INVALID')
    expect((await call('POST', '/issues', pm, { type: 'task', title: 'x'.repeat(1001) })).json.code).toBe('ISSUE_INPUT_INVALID')
    expect((await call('POST', '/issues', pm, { type: 'task', title: 'x', points: 4 })).json.code).toBe('ISSUE_INPUT_INVALID')
    expect((await call('GET', '/issues?type=saga', pm)).json.code).toBe('ISSUE_INPUT_INVALID')
  })

  test('who may do what is decided by the project role', async () => {
    expect((await call('POST', '/issues', plain, { type: 'epic', title: 'No' })).json.code).toBe('ROLE_NOT_ALLOWED')
    expect((await call('POST', '/issues', plain, { type: 'bug', title: 'Filed by anyone' })).status).toBe(201)
    expect((await call('GET', '/issues', viewer)).status).toBe(200)
    expect((await call('POST', '/issues', viewer, { type: 'bug', title: 'No' })).json.code).toBe('ROLE_NOT_ALLOWED')
    const hidden = await call('GET', '/issues', stranger)
    expect(hidden.status).toBe(404)
    expect(hidden.json.code).toBe('WORKSPACE_NOT_FOUND')
    expect((await call('GET', '/issues', null)).status).toBe(401)
  })

  test('any member sets points, and a status change is checked', async () => {
    const task = await makeTask('estimate me', { points: null })
    expect(data(await call('PATCH', `/issues/${task.id}`, plain, { points: 8 })).issue.points).toBe(8)
    expect((await call('PATCH', `/issues/${task.id}`, plain, { title: 'hijack' })).json.code).toBe('ROLE_NOT_ALLOWED')
    expect((await call('PATCH', `/issues/${task.id}`, pm, { status: 'draft' })).json.code).toBe('ISSUE_STATUS_NOT_ALLOWED')
    expect(data(await call('PATCH', `/issues/${task.id}`, pm, { status: 'in_progress' })).issue.status).toBe('in_progress')
  })

  test('items are ranked, drafts are published, and the backlog reads in order', async () => {
    const [a, b, c] = [await makeTask('r a'), await makeTask('r b'), await makeTask('r c')]
    const moved = await call('POST', `/issues/${c.id}/rank`, pm, { afterId: a.id, beforeId: b.id })
    expect(moved.status).toBe(200)
    const story = data(await call('POST', '/issues', pm, { type: 'story', title: 'r story' })).issue as Body
    expect((await call('GET', `/issues/${story.id}`, plain)).status).toBe(404)
    expect(data(await call('POST', `/issues/${story.id}/publish`, pm)).issue.publishedAt).not.toBeNull()
    expect((await call('GET', `/issues/${story.id}`, plain)).status).toBe(200)
    expect((await call('POST', `/issues/${a.id}/rank`, plain, { afterId: b.id })).json.code).toBe('ROLE_NOT_ALLOWED')

    const backlog = await call('GET', '/backlog?limit=100', plain)
    expect(backlog.status).toBe(200)
    const titles = data(backlog).backlog.items.map((issue: Body) => issue.title).filter((title: string) => title.startsWith('r '))
    expect(titles).toEqual(['r a', 'r c', 'r b', 'r story'])
    expect(Array.isArray(data(backlog).sprints)).toBe(true)
  })

  test('a checklist and links work end to end', async () => {
    const [a, b] = [await makeTask('check a'), await makeTask('check b')]
    const added = await call('POST', `/issues/${a.id}/checklist`, pm, { title: 'Write it' })
    expect(added.status).toBe(201)
    const item = data(added).item as Body
    expect(data(await call('PATCH', `/issues/${a.id}/checklist/${item.id}`, pm, { done: true })).item.done).toBe(true)
    expect(data(await call('GET', `/issues/${a.id}/checklist`, plain)).items).toHaveLength(1)
    expect((await call('DELETE', `/issues/${a.id}/checklist/${item.id}`, pm)).status).toBe(204)
    expect((await call('POST', `/issues/${a.id}/checklist`, pm, { title: '   ' })).json.code).toBe('ISSUE_INPUT_INVALID')

    const linked = await call('POST', `/issues/${a.id}/links`, pm, { toId: b.key, kind: 'blocks' })
    expect(linked.status).toBe(201)
    const link = data(linked).links[0] as Body
    expect(link).toMatchObject({ kind: 'blocks', direction: 'out', issueId: b.id })
    expect((await call('POST', `/issues/${b.id}/links`, pm, { toId: a.id, kind: 'blocks' })).json.code).toBe('ISSUE_INPUT_INVALID')
    expect((await call('DELETE', `/issues/${a.id}/links/${link.id}`, pm)).status).toBe(204)
    expect(data(await call('GET', `/issues/${a.id}/links`, plain)).links).toHaveLength(0)
  })

  test('a sprint is created, filled, started, and closed', async () => {
    const task = await makeTask('sprint work')
    const sprintResponse = await call('POST', '/sprints', pm, { name: 'Sprint 1', goal: 'Ship', startsOn: '2026-08-03', endsOn: '2026-08-17' })
    expect(sprintResponse.status).toBe(201)
    const sprint = data(sprintResponse).sprint as Body
    expect((await call('POST', '/sprints', plain, { name: 'No', startsOn: '2026-08-03', endsOn: '2026-08-17' })).json.code).toBe('ROLE_NOT_ALLOWED')
    expect((await call('POST', '/sprints', pm, { name: 'Bad', startsOn: '2026-08-03', endsOn: '2026-09-30' })).json.code).toBe('SPRINT_INPUT_INVALID')

    expect((await call('POST', `/sprints/${sprint.id}/items`, pm, { issueId: task.key })).status).toBe(201)
    const loose = await makeTask('no points', { points: null })
    const refused = await call('POST', `/sprints/${sprint.id}/items`, pm, { issueId: loose.id })
    expect(refused.status).toBe(409)
    expect(refused.json).toMatchObject({ code: 'SPRINT_ITEM_NOT_READY', details: { missing: ['points'] } })

    expect(data(await call('POST', `/sprints/${sprint.id}/start`, pm)).sprint.status).toBe('active')
    const other = data(await call('POST', '/sprints', pm, { name: 'Sprint 2', startsOn: '2026-08-18', endsOn: '2026-09-01' })).sprint as Body
    expect((await call('POST', `/sprints/${other.id}/start`, pm)).json.code).toBe('SPRINT_ALREADY_ACTIVE')
    expect(data(await call('GET', '/sprints', plain)).sprints.length).toBeGreaterThanOrEqual(2)
    expect((await call('POST', `/sprints/${sprint.id}/close`, pm, { carryTo: 'backlog' })).status).toBe(200)
    expect((await call('POST', `/sprints/${sprint.id}/close`, pm, { carryTo: 'backlog' })).json.code).toBe('SPRINT_NOT_EDITABLE')
    expect((await call('DELETE', `/sprints/${other.id}/items/${task.id}`, pm)).json.code).toBe('ISSUE_INPUT_INVALID')
  })

  test('the PM renames the project key, and the old key still opens the issues', async () => {
    const task = await makeTask('keyed')
    const oldKey = (task.key as string).split('-')[0]
    const newKey = `NK${oldKey}`.slice(0, 10)
    const renamed = await http.call('PATCH', base, { token: pm.token, body: { key: newKey, productGoal: 'Halve checkout time' } })
    expect(renamed.status).toBe(200)
    expect(data(renamed).project).toMatchObject({ key: newKey, productGoal: 'Halve checkout time' })
    expect(data(await call('GET', `/issues/${newKey}-${task.number}`, plain)).issue.id).toBe(task.id)
    expect(data(await call('GET', `/issues/${oldKey}-${task.number}`, plain)).issue.id).toBe(task.id)
    expect((await http.call('PATCH', base, { token: plain.token, body: { productGoal: 'x' } })).json.code).toBe('ROLE_NOT_ALLOWED')
    expect((await http.call('PATCH', base, { token: pm.token, body: { key: 'no' } })).json.code).toBe('PROJECT_INPUT_INVALID')
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: plain.token })
    expect((projects.json.data as Body).projects[0]).toMatchObject({ key: newKey, mode: 'scrum', productGoal: 'Halve checkout time' })
  })

  async function approvedPrd(content: string) {
    const id = crypto.randomUUID()
    await db`INSERT INTO planning_documents (id, workspace_id, kind, title, status, current_version, created_by) VALUES (${id}, ${workspaceId}, 'prd', 'Route PRD', 'approved', 1, ${owner.user.id})`
    await db`INSERT INTO planning_document_versions (document_id, version, content, created_by) VALUES (${id}, 1, ${content}, ${owner.user.id})`
    return id
  }

  test('the PM makes draft epics and stories from the headings of an approved PRD', async () => {
    const doc = await approvedPrd('# PRD\n\n## Payment\nPay.\n\n### Pay by card\nCard.\n\n## Delivery\nShip.')
    const response = await call('POST', `/documents/${doc}/draft-backlog`, pm)
    expect(response.status).toBe(201)
    const issues = data(response).issues as Body[]
    expect(issues.map((issue) => [issue.type, issue.title])).toEqual([
      ['epic', 'Payment'],
      ['story', 'Pay by card'],
      ['epic', 'Delivery'],
    ])
    expect(issues.every((issue) => issue.publishedAt === null && issue.sourceDocumentId === doc)).toBe(true)
    const again = await call('POST', `/documents/${doc}/draft-backlog`, pm)
    expect(again.status).toBe(200)
    expect(data(again).issues).toEqual([])
  })

  test('a hand-made outline works, a bad one is refused, and only the PM may ask', async () => {
    const doc = await approvedPrd('# PRD\n\n## Search\nFind things.')
    expect((await call('POST', `/documents/${doc}/draft-backlog`, plain)).json.code).toBe('ROLE_NOT_ALLOWED')
    expect((await call('POST', `/documents/${doc}/draft-backlog`, pm, { epics: [{ title: 'Find', color: 'red' }] })).json.code).toBe('ISSUE_INPUT_INVALID')
    expect((await call('POST', `/documents/${doc}/draft-backlog`, pm, { epics: [{ title: 'Find', sourceSection: 'Not there' }] })).json.code).toBe('ISSUE_INPUT_INVALID')
    const made = await call('POST', `/documents/${doc}/draft-backlog`, pm, { epics: [{ title: 'Find', sourceSection: 'Search', stories: [{ title: 'By name', points: 2 }] }] })
    expect(made.status).toBe(201)
    expect((data(made).issues as Body[]).map((issue) => issue.title)).toEqual(['Find', 'By name'])
    expect((await call('POST', `/documents/${crypto.randomUUID()}/draft-backlog`, pm)).json.code).toBe('PLANNING_NOT_FOUND')
  })

  test('a new PRD version flags the issue until the PM marks it reviewed', async () => {
    const doc = await approvedPrd('# PRD\n\n## Reports\nNumbers.')
    const [epic] = data(await call('POST', `/documents/${doc}/draft-backlog`, pm)).issues as Body[]
    await db`UPDATE planning_documents SET current_version = 2 WHERE id = ${doc}`
    await db`INSERT INTO planning_document_versions (document_id, version, content, created_by) VALUES (${doc}, 2, 'changed', ${owner.user.id})`
    expect(data(await call('GET', `/issues/${epic.id}`, pm)).issue.sourceOutdated).toBe(true)
    expect((await call('POST', `/issues/${epic.id}/source-reviewed`, plain)).json.code).toBe('ISSUE_NOT_FOUND')
    const reviewed = await call('POST', `/issues/${epic.id}/source-reviewed`, pm)
    expect(reviewed.status).toBe(200)
    expect(data(reviewed).issue).toMatchObject({ sourceOutdated: false, sourceReviewedVersion: 2 })
  })

  test('the sprint reports are read by members, with a burndown, a report, and the velocity', async () => {
    const task = await makeTask('report work', { points: 5 })
    const start = new Date().toISOString().slice(0, 10)
    const end = new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10)
    const sprint = data(await call('POST', '/sprints', pm, { name: 'Reported', startsOn: start, endsOn: end })).sprint as Body
    await call('POST', `/sprints/${sprint.id}/items`, pm, { issueId: task.id })
    await call('POST', `/sprints/${sprint.id}/start`, pm)

    const burndown = await call('GET', `/sprints/${sprint.id}/burndown`, plain)
    expect(burndown.status).toBe(200)
    expect(data(burndown)).toMatchObject({ sprintId: sprint.id, total: 5 })
    expect(data(burndown).days).toHaveLength(7)
    expect(data(burndown).days[0]).toMatchObject({ date: start, remaining: 5, ideal: 5 })

    const report = await call('GET', `/sprints/${sprint.id}/report`, viewer)
    expect(data(report)).toMatchObject({ committedPoints: 5, completedPoints: 0 })
    expect(data(report).notCompleted.map((item: Body) => item.id)).toEqual([task.id])

    await call('POST', `/sprints/${sprint.id}/close`, pm, { carryTo: 'backlog' })
    const velocity = await call('GET', '/reports/velocity?limit=2', plain)
    expect(velocity.status).toBe(200)
    expect(data(velocity).sprints.at(-1)).toMatchObject({ name: 'Reported', committedPoints: 5, completedPoints: 0 })
    expect(typeof data(velocity).averageCompleted).toBe('number')

    expect((await call('GET', `/sprints/${sprint.id}/report`, stranger)).json.code).toBe('WORKSPACE_NOT_FOUND')
    expect((await call('GET', `/sprints/${crypto.randomUUID()}/burndown`, pm)).json.code).toBe('SPRINT_NOT_FOUND')
    expect((await call('GET', '/reports/velocity', null)).status).toBe(401)
  })

  test('the Kanban limits and numbers are read by members and set by the PM', async () => {
    expect((await call('PUT', '/wip-limits/in_progress', plain, { limit: 3 })).json.code).toBe('ROLE_NOT_ALLOWED')
    const set = await call('PUT', '/wip-limits/in_progress', pm, { limit: 3 })
    expect(set.status).toBe(200)
    expect(data(set).limits).toEqual([{ status: 'in_progress', limit: 3 }])
    expect(data(await call('GET', '/wip-limits', viewer)).limits).toEqual([{ status: 'in_progress', limit: 3 }])
    expect((await call('PUT', '/wip-limits/in_progress', pm, { limit: 0 })).json.code).toBe('PROJECT_INPUT_INVALID')
    expect((await call('PUT', '/wip-limits/done', pm, { limit: 2 })).json.code).toBe('PROJECT_INPUT_INVALID')
    expect((await call('PUT', '/wip-limits/in_progress', pm, { limit: 2, extra: true })).json.code).toBe('PROJECT_INPUT_INVALID')
    expect(data(await call('PUT', '/wip-limits/in_progress', pm, { limit: null })).limits).toEqual([])

    const flow = await call('GET', '/flow?days=14', plain)
    expect(flow.status).toBe(200)
    expect(data(flow)).toMatchObject({ days: 14 })
    expect(data(flow).cumulativeFlow).toHaveLength(14)
    expect(data(flow).throughput.perDay).toHaveLength(14)
    expect((await call('GET', '/flow', stranger)).json.code).toBe('WORKSPACE_NOT_FOUND')
  })

  test('a path that is not a route is not found', async () => {
    expect((await call('DELETE', '/issues', pm)).json.code).toBe('ROUTE_NOT_FOUND')
    expect((await call('GET', '/issues/x/rank', pm)).json.code).toBe('ROUTE_NOT_FOUND')
  })
})
