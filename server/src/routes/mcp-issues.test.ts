import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { GUIDE_VERSION } from '@/services/mcp-guides'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'

type Body = Record<string, any>

describe.skipIf(!databaseEnabled)('MCP issue tools', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>
  let owner: TestAccount
  let pm: TestAccount
  let dev: TestAccount
  let viewer: TestAccount
  let workspaceId: string
  let projectId: string
  let pmKey: string
  let devKey: string
  let viewerKey: string

  const api = (method: string, path: string, who: TestAccount, body?: unknown) => http.call(method, `/api/workspaces/${workspaceId}/projects/${projectId}${path}`, { token: who.token, body })
  const data = (response: { json: Record<string, unknown> }) => response.json.data as Body

  async function keyOf(member: TestAccount, name: string) {
    const created = await http.call('POST', '/api/me/mcp-keys', { token: member.token, body: { name, validDays: 30 } })
    const secret = (created.json.data as { secret: string }).secret
    await http.mcp(secret, 'tools/call', { name: 'planning_guide', arguments: {} })
    return secret
  }
  async function call(key: string, name: string, args: Body = {}) {
    const response = await http.mcp(key, 'tools/call', { name, arguments: { workspaceId, ...args } })
    const result = response.json.result as { content: Array<{ text: string }>; isError: boolean } | undefined
    return { isError: result?.isError ?? true, value: result ? JSON.parse(result.content[0].text) : response.json.error }
  }

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
    owner = await http.signUp('mi-owner')
    pm = await http.signUp('mi-pm')
    dev = await http.signUp('mi-dev')
    viewer = await http.signUp('mi-viewer')
    workspaceId = await http.createWorkspace(owner, 'MCP issues')
    for (const [who, role] of [[pm, 'editor'], [dev, 'editor'], [viewer, 'viewer']] as const) await http.inviteAndAccept(owner, workspaceId, who, role)
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
    projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
    const members = `/api/workspaces/${workspaceId}/projects/${projectId}/members`
    await http.call('POST', members, { token: owner.token, body: { userId: pm.user.id, disciplines: ['pm'] } })
    await http.call('POST', members, { token: owner.token, body: { userId: dev.user.id, disciplines: ['backend'] } })
    await http.call('POST', members, { token: owner.token, body: { userId: viewer.user.id, disciplines: ['pm'] } })
    pmKey = await keyOf(pm, 'pm agent')
    devKey = await keyOf(dev, 'dev agent')
    viewerKey = await keyOf(viewer, 'viewer agent')
  })

  afterAll(async () => {
    await db.close()
  })

  test('the playbook is the new version and explains the issue model', async () => {
    const guide = await call(pmKey, 'planning_guide')
    expect(JSON.stringify(guide.value)).toContain(GUIDE_VERSION)
    expect(JSON.stringify(guide.value)).toContain('backlog_list')
    expect(JSON.stringify(guide.value)).toContain('locked true')
  })

  test('the tools are listed for the roles that hold them', async () => {
    const names = async (key: string) => ((await http.mcp(key, 'tools/list')).json.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name)
    const pmTools = await names(pmKey)
    const devTools = await names(devKey)
    for (const tool of ['backlog_list', 'sprint_get_active', 'issue_read', 'issue_draft', 'issue_comment', 'subtask_update_status', 'checklist_set_done']) expect(pmTools).toContain(tool)
    expect(devTools).toContain('backlog_list')
    expect(devTools).toContain('issue_draft')
  })

  test('an agent drafts an issue that stays a draft, and the PM publishes it', async () => {
    const made = await call(pmKey, 'issue_draft', { type: 'story', title: 'Pay with a card', points: 5, acceptanceCriteria: 'The card is charged once', clientRequestId: 'draft-1' })
    expect(made.isError).toBe(false)
    expect(made.value).toMatchObject({ type: 'story', title: 'Pay with a card', status: 'draft', publishedAt: null })
    const again = await call(pmKey, 'issue_draft', { type: 'story', title: 'Pay with a card', points: 5, acceptanceCriteria: 'The card is charged once', clientRequestId: 'draft-1' })
    expect(again.value.id).toBe(made.value.id)
    expect((await api('GET', `/issues/${made.value.id}`, dev)).json.code).toBe('ISSUE_NOT_FOUND')
    expect((await call(devKey, 'issue_read', { issueId: made.value.id })).value.code).toBe('ISSUE_NOT_FOUND')
    expect((await call(pmKey, 'issue_read', { issueId: made.value.key })).value.issue.id).toBe(made.value.id)
  })

  test('an agent without the planning role cannot draft, and bad input is refused', async () => {
    const refused = await call(devKey, 'issue_draft', { type: 'task', title: 'No' })
    expect(refused.isError).toBe(true)
    expect(['MCP_PERMISSION_DENIED', 'ROLE_NOT_ALLOWED']).toContain(refused.value.code)
    expect((await call(pmKey, 'issue_draft', { type: 'task', title: 'Bad', points: 4 })).value.code).toBe('ISSUE_INPUT_INVALID')
    // Only the tech lead, or a member whose role matches, makes a sub-task. The PM does not.
    expect((await call(pmKey, 'issue_draft', { type: 'subtask', title: 'Not mine to make', role: 'backend' })).value.code).toBe('ROLE_NOT_ALLOWED')
    expect((await call(viewerKey, 'issue_draft', { type: 'bug', title: 'Viewer' })).isError).toBe(true)
  })

  test('the backlog and the active sprint are read through the tools', async () => {
    const task = data(await api('POST', '/issues', pm, { type: 'task', title: 'Tool backlog task', points: 3 })).issue as Body
    const sprint = data(await api('POST', '/sprints', pm, { name: 'Tool sprint', goal: 'Read it', startsOn: new Date().toISOString().slice(0, 10), endsOn: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10) })).sprint as Body

    const before = await call(devKey, 'sprint_get_active')
    expect(before.value).toEqual({ sprint: null, issues: [] })
    const planned = await call(devKey, 'backlog_list', { limit: 100 })
    expect(planned.value.sprints.map((item: Body) => item.name)).toContain('Tool sprint')
    expect(planned.value.backlog.items.map((item: Body) => item.id)).toContain(task.id)

    await api('POST', `/sprints/${sprint.id}/items`, pm, { issueId: task.id })
    await api('POST', `/sprints/${sprint.id}/start`, pm)
    const active = await call(devKey, 'sprint_get_active')
    expect(active.value.sprint).toMatchObject({ name: 'Tool sprint', status: 'active' })
    expect(active.value.issues.map((item: Body) => item.id)).toEqual([task.id])
  })

  test('a sub-task is moved and a checklist ticked only by the agent it is assigned to', async () => {
    const story = data(await api('POST', '/issues', pm, { type: 'story', title: 'Story for sub-tasks' })).issue as Body
    await api('POST', `/issues/${story.id}/publish`, pm)
    const mine = data(await api('POST', '/issues', owner, { type: 'subtask', title: 'Mine', parentId: story.id, role: 'backend', assigneeId: dev.user.id })).issue as Body
    const theirs = data(await api('POST', '/issues', owner, { type: 'subtask', title: 'Theirs', parentId: story.id, role: 'backend', assigneeId: pm.user.id })).issue as Body

    const moved = await call(devKey, 'subtask_update_status', { subtaskId: mine.id, status: 'in_progress' })
    expect(moved.value).toMatchObject({ id: mine.id, status: 'in_progress' })
    expect((await call(devKey, 'subtask_update_status', { subtaskId: theirs.id, status: 'in_progress' })).value.code).toBe('ISSUE_AGENT_FORBIDDEN')
    expect((await call(devKey, 'subtask_update_status', { subtaskId: story.id, status: 'done' })).value.code).toBe('ISSUE_INPUT_INVALID')

    const line = data(await api('POST', `/issues/${mine.id}/checklist`, pm, { title: 'Write the endpoint' })).item as Body
    const ticked = await call(devKey, 'checklist_set_done', { issueId: mine.id, itemId: line.id, done: true })
    expect(ticked.value).toMatchObject({ id: line.id, done: true })
    const other = data(await api('POST', `/issues/${theirs.id}/checklist`, pm, { title: 'Not yours' })).item as Body
    expect((await call(devKey, 'checklist_set_done', { issueId: theirs.id, itemId: other.id, done: true })).value.code).toBe('ISSUE_AGENT_FORBIDDEN')
    const read = await call(devKey, 'issue_read', { issueId: mine.id })
    expect(read.value.checklist.map((item: Body) => [item.title, item.done])).toEqual([['Write the endpoint', true]])
  })

  test('an agent comments on an issue and a comment can be answered', async () => {
    const task = data(await api('POST', '/issues', pm, { type: 'task', title: 'Talk about me', assigneeId: dev.user.id })).issue as Body
    const first = await call(pmKey, 'issue_comment', { issueId: task.id, body: 'Please look at this' })
    expect(first.isError).toBe(false)
    expect(first.value).toMatchObject({ mentioned: [], unknownMentions: [] })
    expect(typeof first.value.id).toBe('string')
    const thread = await call(pmKey, 'discussion_read', { targetKind: 'task', targetId: task.id })
    expect(thread.value.map((comment: Body) => comment.body)).toEqual(['Please look at this'])
    expect((await call(pmKey, 'issue_comment', { issueId: 'nope-nope', body: 'x' })).value.code).toBe('ISSUE_NOT_FOUND')
  })

  test('any member holds issue_draft, and drafts a bug with it', async () => {
    const names = ((await http.mcp(devKey, 'tools/list')).json.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name)
    expect(names).toContain('issue_draft')
    expect(names.filter((name) => name === 'issue_draft')).toHaveLength(1)
    const drafted = await call(devKey, 'issue_draft', { type: 'bug', title: 'Crash on refund', clientRequestId: 'bug-by-dev' })
    expect(drafted.isError).toBe(false)
    expect(drafted.value).toMatchObject({ type: 'bug', title: 'Crash on refund', publishedAt: null })
  })

  test('the older tools that another tool replaces are gone, and an agent moves its own sub-task with the new one', async () => {
    const parent = data(await api('POST', '/issues', owner, { type: 'task', title: 'Parent for the sub-task tool', points: 2, assigneeId: dev.user.id })).issue
    const sub = data(await api('POST', '/issues', owner, { type: 'subtask', title: 'Sub for the sub-task tool', parentId: parent.id, role: 'backend', assigneeId: dev.user.id })).issue

    for (const gone of ['tasks_get_assigned', 'tasks_update_assigned_status', 'tasks_comment_assigned', 'stories_comment_participating', 'subtasks_list', 'subtask_add', 'subtask_set_done']) {
      const refused = await http.mcp(devKey, 'tools/call', { name: gone, arguments: { workspaceId, taskId: sub.id } })
      expect(refused.json.error).toMatchObject({ code: -32602 })
    }

    const refused = await call(devKey, 'subtask_update_status', { subtaskId: parent.id, status: 'done' })
    expect(refused.isError).toBe(true)
    expect(data(await api('GET', `/issues/${parent.id}`, owner)).issue.status).toBe('todo')

    const moved = await call(devKey, 'subtask_update_status', { subtaskId: sub.id, status: 'in_progress' })
    expect(moved.isError).toBe(false)
    expect(data(await api('GET', `/issues/${sub.id}`, owner)).issue.status).toBe('in_progress')
    const events = await db`SELECT api_key_id FROM issue_status_events WHERE issue_id = ${sub.id} AND to_status = 'in_progress'`
    expect(events).toHaveLength(1)
    expect(events[0].api_key_id).not.toBeNull()
  })

  test('an agent adds a line to a checklist, reads it with issue_read, and ticks it', async () => {
    const task = data(await api('POST', '/issues', owner, { type: 'task', title: 'Task with a checklist', points: 1, assigneeId: dev.user.id })).issue
    const added = await call(devKey, 'checklist_add', { issueId: task.id, title: 'Write the migration', clientRequestId: 'check-1' })
    expect(added.isError).toBe(false)
    expect(added.value).toMatchObject({ title: 'Write the migration', done: false })
    const again = await call(devKey, 'checklist_add', { issueId: task.id, title: 'Write the migration', clientRequestId: 'check-1' })
    expect(again.value.id).toBe(added.value.id)
    const read = await call(devKey, 'issue_read', { issueId: task.id })
    expect(read.value.checklist.map((item: Body) => item.title)).toEqual(['Write the migration'])
    expect((await call(devKey, 'checklist_set_done', { issueId: task.id, itemId: added.value.id, done: true })).value.done).toBe(true)
    expect((await call(devKey, 'checklist_add', { issueId: task.id, title: '   ' })).isError).toBe(true)
  })

  test('the issue tools use the oldest project of the workspace, as the portal does, however recently another was changed', async () => {
    const secondId = crypto.randomUUID()
    await db`INSERT INTO projects (id, workspace_id, name, created_by, key, updated_at) VALUES (${secondId}, ${workspaceId}, 'Second', ${owner.user.id}, 'ZZ', now() + interval '1 hour')`
    const drafted = await call(pmKey, 'issue_draft', { type: 'task', title: 'Lands in the first project', clientRequestId: 'oldest-project' })
    expect(drafted.isError).toBe(false)
    expect(drafted.value.projectId).toBe(projectId)
    const listed = await call(pmKey, 'backlog_list')
    expect(JSON.stringify(listed.value)).toContain('Lands in the first project')
  })
})
