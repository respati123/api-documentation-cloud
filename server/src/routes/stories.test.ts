import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'
import { onNotification } from '@/services/notification-bus'
import { planningAudience } from '@/services/planning-audience'

type Story = {
  stage: string
  userStory: { role: string }
  definitionOfDone: Array<{ id: string; text: string; done: boolean }>
  designs: unknown[]
  contracts: Array<{ requestId: string; method: string; path: string; missing: boolean }>
  testCases: Array<{ code: string }>
}
type BoardTask = { id: string; role: string | null; locked: boolean; storyId: string; dependsOn: string[]; subtaskDone: number; subtaskTotal: number }

describe.skipIf(!databaseEnabled)('story artifacts and task locks', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
  })

  afterAll(async () => {
    await db.close()
  })

  async function memberWithRole(owner: TestAccount, workspaceId: string, label: string, discipline: string, role: 'editor' | 'viewer' = 'editor') {
    const member = await http.signUp(label)
    await http.inviteAndAccept(owner, workspaceId, member, role)
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
    const projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
    await http.call('POST', `/api/workspaces/${workspaceId}/projects/${projectId}/members`, { token: owner.token, body: { userId: member.user.id, discipline } })
    return member
  }

  // A workspace with one request in its collection, an approved PRD, and an epic with one story and two task drafts.
  async function project(label: string) {
    const owner = await http.signUp(`${label}-owner`)
    const tree = [{ id: 'req-invite', kind: 'request', name: 'Invite member', method: 'POST', url: '{{baseUrl}}/workspaces/{id}/invites', body: '' }]
    const made = await http.call('POST', '/api/workspaces', { token: owner.token, body: { name: label, tree, variables: { globals: [], environments: [] } } })
    const workspaceId = (made.json.data as { workspace: { id: string } }).workspace.id
    const base = `/api/workspaces/${workspaceId}/planning`
    const call = (method: string, path: string, body?: unknown) => http.call(method, `${base}${path}`, { token: owner.token, body })
    const brd = await call('POST', '/documents', { kind: 'brd', title: 'BRD', content: 'Needs' })
    const brdId = (brd.json.data as { document: { id: string } }).document.id
    const prd = await call('POST', '/documents', { kind: 'prd', title: 'PRD', content: 'Product', sourceDocumentId: brdId })
    const prdId = (prd.json.data as { document: { id: string } }).document.id
    for (const status of ['review_pm', 'review_team', 'approved']) await call('POST', `/documents/${prdId}/status`, { status })
    const epic = await call('POST', '/items', { kind: 'epic', title: 'Team access', sourceDocumentId: prdId })
    const epicId = (epic.json.data as { item: { id: string } }).item.id
    const story = await call('POST', '/items', { kind: 'story', parentId: epicId, title: 'Invite by email', acceptanceCriteria: 'Invite shows', sourceDocumentId: prdId })
    const storyId = (story.json.data as { item: { id: string } }).item.id
    await call('POST', '/task-drafts', { storyId, title: 'Design dialog', role: 'ui_ux' })
    await call('POST', '/task-drafts', { storyId, title: 'Invite endpoint', role: 'backend' })
    for (const status of ['refinement', 'ready']) {
      await call('PATCH', `/items/${storyId}`, { status })
      await call('PATCH', `/items/${epicId}`, { status })
    }
    const published = await call('POST', `/items/${epicId}/publish`)
    expect(published.status).toBe(200)
    return { owner, workspaceId, storyId, call }
  }

  async function boardTasks(owner: TestAccount, workspaceId: string): Promise<BoardTask[]> {
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
    const projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
    const tasks = await http.call('GET', `/api/workspaces/${workspaceId}/projects/${projectId}/tasks`, { token: owner.token })
    return (tasks.json.data as { tasks: BoardTask[] }).tasks
  }

  test('the PM writes the user story, flow, and Definition of Done, and a participant ticks an item', async () => {
    const { owner, workspaceId, storyId, call } = await project('story-text')

    const updated = await call('PATCH', `/stories/${storyId}`, {
      userStory: { role: 'owner', action: 'invite by email', benefit: 'the team reads the docs' },
      flow: '## Main flow\n1. Open Team.',
      definitionOfDone: [{ text: 'Design approved', role: 'ui_ux' }, { text: 'Endpoint on staging', role: 'backend' }],
    })
    const story = (updated.json.data as { story: Story }).story
    expect(story.userStory.role).toBe('owner')
    expect(story.definitionOfDone).toHaveLength(2)

    const ticked = await http.call('PATCH', `/api/workspaces/${workspaceId}/planning/stories/${storyId}/dod/${story.definitionOfDone[0].id}`, { token: owner.token, body: { done: true } })
    expect((ticked.json.data as { story: Story }).story.definitionOfDone[0].done).toBe(true)
  })

  test('a design link must be http or https', async () => {
    const { storyId, call } = await project('story-url')

    const refused = await call('POST', `/stories/${storyId}/designs`, { title: 'Dialog', url: 'javascript:alert(1)' })

    expect(refused.status).toBe(400)
    expect(refused.json.code).toBe('PLANNING_INPUT_INVALID')
  })

  test('other roles stay locked until a tech lead approves the design, and a backend member cannot approve', async () => {
    const { owner, workspaceId, storyId, call } = await project('story-lock')
    const lead = await memberWithRole(owner, workspaceId, 'lock-lead', 'tech_lead')
    const backend = await memberWithRole(owner, workspaceId, 'lock-backend', 'backend')
    await call('POST', `/stories/${storyId}/designs`, { title: 'Dialog', url: 'https://design.test/dialog' })

    const before = await boardTasks(owner, workspaceId)
    const backendTask = before.find((task) => task.role === 'backend') as BoardTask
    const designTask = before.find((task) => task.role === 'ui_ux') as BoardTask
    expect(backendTask.locked).toBe(true)
    expect(designTask.locked).toBe(false)
    const moved = await http.call('PATCH', `/api/workspaces/${workspaceId}/tasks/${backendTask.id}`, { token: owner.token, body: { status: 'todo' } })
    expect(moved.status).toBe(409)
    expect(moved.json.code).toBe('TASK_LOCKED')

    const refused = await http.call('POST', `/api/workspaces/${workspaceId}/planning/stories/${storyId}/approve-design`, { token: backend.token })
    expect(refused.status).toBe(403)
    const approved = await http.call('POST', `/api/workspaces/${workspaceId}/planning/stories/${storyId}/approve-design`, { token: lead.token })
    expect((approved.json.data as { story: Story }).story.stage).toBe('design_approved')

    expect((await boardTasks(owner, workspaceId)).find((task) => task.id === backendTask.id)?.locked).toBe(false)
    const movedAfter = await http.call('PATCH', `/api/workspaces/${workspaceId}/tasks/${backendTask.id}`, { token: owner.token, body: { status: 'todo' } })
    expect(movedAfter.status).toBe(200)
  })

  test('approving a design needs at least one design', async () => {
    const { storyId, call } = await project('story-nodesign')

    const refused = await call('POST', `/stories/${storyId}/approve-design`)

    expect(refused.status).toBe(409)
  })

  test('an API contract links to a request in the collection and reports it missing when the id is unknown', async () => {
    const { storyId, call } = await project('story-contract')

    const linked = await call('POST', `/stories/${storyId}/contracts`, { requestId: 'req-invite' })
    expect(linked.status).toBe(201)
    const unknown = await call('POST', `/stories/${storyId}/contracts`, { requestId: 'req-gone' })
    expect(unknown.json.code).toBe('CONTRACT_REQUEST_NOT_FOUND')

    const story = ((await call('GET', `/stories/${storyId}`)).json.data as { story: Story }).story
    expect(story.contracts).toEqual([expect.objectContaining({ requestId: 'req-invite', method: 'POST', path: '/workspaces/{id}/invites', missing: false })])
  })

  test('test cases are numbered per story', async () => {
    const { storyId, call } = await project('story-tests')

    const first = await call('POST', `/stories/${storyId}/test-cases`, { title: 'Invite new email', precondition: 'Owner', steps: ['Open Team'], expected: ['Invite shows'] })
    const second = await call('POST', `/stories/${storyId}/test-cases`, { title: 'Existing member', steps: ['Invite again'], expected: ['Server message'] })

    expect((first.json.data as { testCase: { code: string } }).testCase.code).toBe('TC-1')
    expect((second.json.data as { testCase: { code: string } }).testCase.code).toBe('TC-2')
  })

  test('sub-tasks and dependencies show on the board task', async () => {
    const { owner, workspaceId } = await project('story-subtasks')
    const [first, second] = await boardTasks(owner, workspaceId)
    const base = `/api/workspaces/${workspaceId}/tasks/${second.id}`

    const added = await http.call('POST', `${base}/subtasks`, { token: owner.token, body: { title: 'Validate email' } })
    await http.call('POST', `${base}/subtasks`, { token: owner.token, body: { title: 'Rate limit' } })
    const subtaskId = (added.json.data as { subtask: { id: string } }).subtask.id
    await http.call('PATCH', `${base}/subtasks/${subtaskId}`, { token: owner.token, body: { done: true } })
    await http.call('PATCH', base, { token: owner.token, body: { dependsOn: [first.id] } })

    const task = (await boardTasks(owner, workspaceId)).find((row) => row.id === second.id)
    expect(task).toMatchObject({ subtaskDone: 1, subtaskTotal: 2, dependsOn: [first.id] })
  })

  test('a task cannot depend on itself', async () => {
    const { owner, workspaceId } = await project('story-selfdep')
    const [task] = await boardTasks(owner, workspaceId)

    const refused = await http.call('PATCH', `/api/workspaces/${workspaceId}/tasks/${task.id}`, { token: owner.token, body: { dependsOn: [task.id] } })

    expect(refused.json.code).toBe('TASK_INPUT_INVALID')
  })

  async function keyFor(member: TestAccount, _role: string, name = 'Agent') {
    // The key carries no role: what it may do follows the roles the member already holds in the workspace.
    const created = await http.call('POST', '/api/me/mcp-keys', { token: member.token, body: { name: name, validDays: 30 } })
    return (created.json.data as { secret: string }).secret
  }


  function toolResult(response: { json: Record<string, unknown> }) {
    const result = response.json.result as { content: Array<{ text: string }>; isError: boolean }
    return { isError: result.isError, value: JSON.parse(result.content[0].text) }
  }

  test('a backend agent links a contract on a story it takes part in, and a frontend agent has no such tool', async () => {
    const { owner, workspaceId, storyId, call } = await project('story-mcp')
    const backend = await memberWithRole(owner, workspaceId, 'mcp-backend', 'backend')
    const frontend = await memberWithRole(owner, workspaceId, 'mcp-frontend', 'frontend')
    await call('PATCH', `/items/${storyId}`, { participantIds: [backend.user.id, frontend.user.id] })

    const backendKey = await keyFor(backend, 'backend')
    await http.mcp(backendKey, 'tools/call', { name: 'planning_guide', arguments: {} })
    const linked = toolResult(await http.mcp(backendKey, 'tools/call', { name: 'story_link_api_contract', arguments: { workspaceId, storyId, requestId: 'req-invite' } }))
    expect(linked.isError).toBe(false)
    const story = toolResult(await http.mcp(backendKey, 'tools/call', { name: 'story_read', arguments: { workspaceId, storyId } }))
    expect(story.value.contracts[0]).toMatchObject({ requestId: 'req-invite', missing: false })

    const frontendKey = await keyFor(frontend, 'frontend')
    const refused = toolResult(await http.mcp(frontendKey, 'tools/call', { name: 'story_link_api_contract', arguments: { workspaceId, storyId, requestId: 'req-invite' } }))
    expect(refused).toMatchObject({ isError: true, value: { code: 'MCP_PERMISSION_DENIED' } })
  })

  test('tasks_list_ready leaves out a task locked by the story design', async () => {
    const { owner, workspaceId } = await project('story-ready')
    const backend = await memberWithRole(owner, workspaceId, 'ready-backend', 'backend')
    const designer = await memberWithRole(owner, workspaceId, 'ready-designer', 'ui_ux')
    const tasks = await boardTasks(owner, workspaceId)
    const backendTask = tasks.find((task) => task.role === 'backend') as BoardTask
    const designTask = tasks.find((task) => task.role === 'ui_ux') as BoardTask
    await http.call('PATCH', `/api/workspaces/${workspaceId}/tasks/${backendTask.id}`, { token: owner.token, body: { assigneeId: backend.user.id } })
    await http.call('PATCH', `/api/workspaces/${workspaceId}/tasks/${designTask.id}`, { token: owner.token, body: { assigneeId: designer.user.id } })

    const backendReady = toolResult(await http.mcp(await keyFor(backend, 'backend'), 'tools/call', { name: 'tasks_list_ready', arguments: { workspaceId } }))
    const designerReady = toolResult(await http.mcp(await keyFor(designer, 'ui_ux'), 'tools/call', { name: 'tasks_list_ready', arguments: { workspaceId } }))

    expect(backendReady.value).toEqual([])
    expect(designerReady.value.map((task: { id: string }) => task.id)).toEqual([designTask.id])
  })

  test('a story cannot start work before its design is approved', async () => {
    const { storyId, call } = await project('story-start')
    await call('POST', `/stories/${storyId}/designs`, { title: 'Dialog', url: 'https://design.test/dialog' })

    const early = await call('PATCH', `/items/${storyId}`, { status: 'in_progress' })
    expect(early.status).toBe(409)

    await call('POST', `/stories/${storyId}/approve-design`)
    const started = await call('PATCH', `/items/${storyId}`, { status: 'in_progress' })
    expect(started.status).toBe(200)
  })

  async function inbox(account: TestAccount) {
    const response = await http.call('GET', '/api/me/notifications', { token: account.token })
    return (response.json.data as { notifications: Array<{ kind: string; data: Record<string, unknown> }> }).notifications
  }

  test('assigning a task, approving its design, and replying each notify the right person, and the push layer hears it', async () => {
    const { owner, workspaceId, storyId, call } = await project('story-notify')
    const backend = await memberWithRole(owner, workspaceId, 'notify-backend', 'backend')
    const lead = await memberWithRole(owner, workspaceId, 'notify-lead', 'tech_lead')
    await call('PATCH', `/items/${storyId}`, { participantIds: [backend.user.id] })
    const pushed: string[] = []
    const stop = onNotification((userId, notification) => {
      if (userId === backend.user.id) pushed.push(notification.kind)
    })

    const backendTask = (await boardTasks(owner, workspaceId)).find((task) => task.role === 'backend') as BoardTask
    await http.call('PATCH', `/api/workspaces/${workspaceId}/tasks/${backendTask.id}`, { token: owner.token, body: { assigneeId: backend.user.id } })
    await call('POST', `/stories/${storyId}/designs`, { title: 'Dialog', url: 'https://design.test/dialog' })
    await http.call('POST', `/api/workspaces/${workspaceId}/planning/stories/${storyId}/approve-design`, { token: lead.token })
    const question = await http.call('POST', `/api/workspaces/${workspaceId}/planning/story/${storyId}/comments`, { token: backend.token, body: { body: 'Batasnya berapa?' } })
    const questionId = (question.json.data as { comment: { id: string } }).comment.id
    await call('POST', `/story/${storyId}/comments`, { body: 'Dua puluh per jam.', parentId: questionId })
    stop()

    const kinds = (await inbox(backend)).map((notification) => notification.kind)
    expect(kinds).toEqual(expect.arrayContaining(['task_assigned', 'design_approved', 'comment_reply']))
    expect(pushed).toEqual(expect.arrayContaining(['task_assigned', 'design_approved', 'comment_reply']))
  })

  test('a comment on a task notifies its assignee, but not when the assignee writes it', async () => {
    const { owner, workspaceId } = await project('story-taskcomment')
    const backend = await memberWithRole(owner, workspaceId, 'taskcomment-backend', 'backend')
    const task = (await boardTasks(owner, workspaceId)).find((row) => row.role === 'backend') as BoardTask
    await http.call('PATCH', `/api/workspaces/${workspaceId}/tasks/${task.id}`, { token: owner.token, body: { assigneeId: backend.user.id } })

    await http.call('POST', `/api/workspaces/${workspaceId}/planning/task/${task.id}/comments`, { token: owner.token, body: { body: 'Sudah sampai mana?' } })

    expect((await inbox(backend)).map((notification) => notification.kind)).toContain('task_comment')
  })

  test('a planning change reaches only the people who may read it', async () => {
    const owner = await http.signUp('audience-owner')
    const tree = [{ id: 'req-a', kind: 'request', name: 'A', method: 'GET', url: '/a', body: '' }]
    const made = await http.call('POST', '/api/workspaces', { token: owner.token, body: { name: 'Audience', tree, variables: { globals: [], environments: [] } } })
    const workspaceId = (made.json.data as { workspace: { id: string } }).workspace.id
    const call = (method: string, path: string, body?: unknown) => http.call(method, `/api/workspaces/${workspaceId}/planning${path}`, { token: owner.token, body })
    const participant = await memberWithRole(owner, workspaceId, 'audience-participant', 'backend')
    const bystander = await memberWithRole(owner, workspaceId, 'audience-bystander', 'frontend')
    const lead = await memberWithRole(owner, workspaceId, 'audience-lead', 'tech_lead')
    const brdId = ((await call('POST', '/documents', { kind: 'brd', title: 'BRD', content: 'x' })).json.data as { document: { id: string } }).document.id
    const prdId = ((await call('POST', '/documents', { kind: 'prd', title: 'PRD', content: 'y', sourceDocumentId: brdId })).json.data as { document: { id: string } }).document.id

    expect((await planningAudience(db, workspaceId, { kind: 'document', id: prdId })).sort()).toEqual([owner.user.id].sort())
    for (const status of ['review_pm', 'review_team', 'approved']) await call('POST', `/documents/${prdId}/status`, { status })
    // An approved PRD reaches the PM, the tech lead, and backend. Frontend does not read documents.
    expect((await planningAudience(db, workspaceId, { kind: 'document', id: prdId })).sort()).toEqual([owner.user.id, participant.user.id, lead.user.id].sort())

    const epicId = ((await call('POST', '/items', { kind: 'epic', title: 'E', sourceDocumentId: prdId })).json.data as { item: { id: string } }).item.id
    const storyId = ((await call('POST', '/items', { kind: 'story', parentId: epicId, title: 'S', acceptanceCriteria: 'ok', sourceDocumentId: prdId, participantIds: [participant.user.id] })).json.data as { item: { id: string } }).item.id
    const draftAudience = await planningAudience(db, workspaceId, { kind: 'item', id: storyId })
    expect(draftAudience).toEqual([owner.user.id])

    await call('POST', '/task-drafts', { storyId, title: 'T', role: 'backend', assigneeId: participant.user.id })
    for (const status of ['refinement', 'ready']) {
      await call('PATCH', `/items/${storyId}`, { status })
      await call('PATCH', `/items/${epicId}`, { status })
    }
    await call('POST', `/items/${epicId}/publish`)
    // Published work is read by every member, so every member hears about it.
    const everyone = [owner.user.id, lead.user.id, participant.user.id, bystander.user.id].sort()
    expect((await planningAudience(db, workspaceId, { kind: 'item', id: storyId })).sort()).toEqual(everyone)

    const task = (await boardTasks(owner, workspaceId))[0]
    expect((await planningAudience(db, workspaceId, { kind: 'task-thread', id: task.id })).sort()).toEqual(everyone)
  })

  test('a PM agent writes story details, and a task draft without a role is refused', async () => {
    const owner = await http.signUp('details-owner')
    const tree = [{ id: 'req-a', kind: 'request', name: 'A', method: 'GET', url: '/a', body: '' }]
    const made = await http.call('POST', '/api/workspaces', { token: owner.token, body: { name: 'Details', tree, variables: { globals: [], environments: [] } } })
    const workspaceId = (made.json.data as { workspace: { id: string } }).workspace.id
    const call = (method: string, path: string, body?: unknown) => http.call(method, `/api/workspaces/${workspaceId}/planning${path}`, { token: owner.token, body })
    const brdId = ((await call('POST', '/documents', { kind: 'brd', title: 'BRD', content: 'x' })).json.data as { document: { id: string } }).document.id
    const prdId = ((await call('POST', '/documents', { kind: 'prd', title: 'PRD', content: 'R1 Owner invites by email', sourceDocumentId: brdId })).json.data as { document: { id: string } }).document.id
    for (const status of ['review_pm', 'review_team', 'approved']) await call('POST', `/documents/${prdId}/status`, { status })
    const pm = await memberWithRole(owner, workspaceId, 'details-pm', 'pm')
    const key = await keyFor(pm, 'pm')
    await http.mcp(key, 'tools/call', { name: 'planning_guide', arguments: {} })
    const tool = (name: string, args: Record<string, unknown>) => http.mcp(key, 'tools/call', { name, arguments: { workspaceId, ...args } })

    const epic = toolResult(await tool('planning_draft_item', { kind: 'epic', title: 'Team access', sourceDocumentId: prdId, sourceSection: 'R1 Owner invites by email' }))
    const missingCriteria = toolResult(await tool('planning_draft_item', { kind: 'story', parentId: epic.value.id, title: 'Invite', sourceDocumentId: prdId, sourceSection: 'R1 Owner invites by email' }))
    expect(missingCriteria.value.code).toBe('MCP_DRAFT_INCOMPLETE')
    const story = toolResult(await tool('planning_draft_item', { kind: 'story', parentId: epic.value.id, title: 'Invite', acceptanceCriteria: 'Given an owner, when they invite, then the invite shows', sourceDocumentId: prdId, sourceSection: 'R1 Owner invites by email' }))
    const details = toolResult(await tool('story_write_details', {
      storyId: story.value.id,
      userStory: { role: 'owner', action: 'invite by email', benefit: 'the team reads the docs' },
      flow: '1. Open Team.',
      definitionOfDone: [{ text: 'Design approved', role: 'ui_ux' }],
    }))
    expect(details.value).toMatchObject({ userStory: { role: 'owner' }, definitionOfDone: [{ text: 'Design approved', role: 'ui_ux' }] })
    expect(toolResult(await tool('planning_draft_task', { storyId: story.value.id, title: 'Design dialog' })).value.code).toBe('MCP_DRAFT_INCOMPLETE')
    expect(toolResult(await tool('planning_draft_task', { storyId: story.value.id, title: 'Design dialog', role: 'ui_ux' })).isError).toBe(false)
  })

  test('agent work on stories and tasks shows in the activity log with the key name, and portal work without one', async () => {
    const { owner, workspaceId, storyId, call } = await project('story-activity')
    const designer = await memberWithRole(owner, workspaceId, 'activity-designer', 'ui_ux')
    await call('PATCH', `/items/${storyId}`, { participantIds: [designer.user.id] })
    const designTask = (await boardTasks(owner, workspaceId)).find((task) => task.role === 'ui_ux') as BoardTask
    await http.call('PATCH', `/api/workspaces/${workspaceId}/tasks/${designTask.id}`, { token: owner.token, body: { assigneeId: designer.user.id } })

    const key = await keyFor(designer, 'ui_ux', 'claude-code laptop')
    await http.mcp(key, 'tools/call', { name: 'planning_guide', arguments: {} })
    expect(toolResult(await http.mcp(key, 'tools/call', { name: 'story_attach_design', arguments: { workspaceId, storyId, title: 'Dialog', url: 'https://design.test/dialog' } })).isError).toBe(false)
    expect(toolResult(await http.mcp(key, 'tools/call', { name: 'tasks_update_assigned_status', arguments: { workspaceId, taskId: designTask.id, status: 'in_progress' } })).isError).toBe(false)
    expect(toolResult(await http.mcp(key, 'tools/call', { name: 'subtask_add', arguments: { workspaceId, taskId: designTask.id, title: 'Empty state' } })).isError).toBe(false)
    await call('POST', `/stories/${storyId}/approve-design`)

    const events = ((await call('GET', '/events')).json.data as { events: Array<{ action: string; targetId: string; apiKeyName: string | null }> }).events
    const find = (action: string, targetId: string) => events.find((entry) => entry.action === action && entry.targetId === targetId)

    expect(find('design_attached', storyId)?.apiKeyName).toBe('claude-code laptop')
    expect(find('status:in_progress', designTask.id)?.apiKeyName).toBe('claude-code laptop')
    expect(find('subtask_added', designTask.id)?.apiKeyName).toBe('claude-code laptop')
    expect(find('design_approved', storyId)).toMatchObject({ apiKeyName: null })
  })
})
