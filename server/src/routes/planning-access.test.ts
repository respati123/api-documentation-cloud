import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'
import { planningAudience } from '@/services/planning-audience'

type Doc = { id: string; kind: string }
type Item = { id: string; kind: string }
type Task = { id: string }

// Who reads what: backend reads the BRD and approved PRDs, the tech lead also PRDs in team review,
// and every member reads published epics, stories, and tasks. Drafts stay with the PM.
describe.skipIf(!databaseEnabled)('planning read access by work role', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
  })

  afterAll(async () => {
    await db.close()
  })

  async function member(owner: TestAccount, workspaceId: string, label: string, discipline: string | null) {
    const account = await http.signUp(label)
    await http.inviteAndAccept(owner, workspaceId, account, 'editor')
    if (discipline) {
      const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
      const projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
      await http.call('POST', `/api/workspaces/${workspaceId}/projects/${projectId}/members`, { token: owner.token, body: { userId: account.user.id, discipline } })
    }
    return account
  }

  async function keyFor(account: TestAccount, role: string) {
    // The key carries no role: what it may do follows the roles the member already holds in the workspace.
    const created = await http.call('POST', '/api/me/mcp-keys', { token: account.token, body: { name: `${role} key`, validDays: 30 } })
    return (created.json.data as { secret: string }).secret
  }


  function toolResult(response: { json: Record<string, unknown> }) {
    const result = response.json.result as { content: Array<{ text: string }>; isError: boolean }
    return { isError: result.isError, value: JSON.parse(result.content[0].text) }
  }

  // A BRD, an approved PRD with one published epic (story + two tasks), a second epic left as a draft,
  // and a second PRD still in team review.
  async function workspace(label: string) {
    const owner = await http.signUp(`${label}-owner`)
    const workspaceId = await http.createWorkspace(owner, label)
    const call = (method: string, path: string, body?: unknown) => http.call(method, `/api/workspaces/${workspaceId}/planning${path}`, { token: owner.token, body })
    const id = (response: { json: Record<string, unknown> }, key: 'document' | 'item') => (response.json.data as Record<string, { id: string }>)[key].id
    const brdId = id(await call('POST', '/documents', { kind: 'brd', title: 'BRD', content: 'Needs' }), 'document')
    const prdId = id(await call('POST', '/documents', { kind: 'prd', title: 'PRD', content: 'Product', sourceDocumentId: brdId }), 'document')
    for (const status of ['review_pm', 'review_team', 'approved']) await call('POST', `/documents/${prdId}/status`, { status })
    const reviewPrdId = id(await call('POST', '/documents', { kind: 'prd', title: 'PRD 2', content: 'Later', sourceDocumentId: brdId }), 'document')
    for (const status of ['review_pm', 'review_team']) await call('POST', `/documents/${reviewPrdId}/status`, { status })

    const epicId = id(await call('POST', '/items', { kind: 'epic', title: 'Published epic', sourceDocumentId: prdId }), 'item')
    const storyId = id(await call('POST', '/items', { kind: 'story', parentId: epicId, title: 'Published story', acceptanceCriteria: 'ok', sourceDocumentId: prdId }), 'item')
    await call('POST', '/task-drafts', { storyId, title: 'Design', role: 'ui_ux' })
    await call('POST', '/task-drafts', { storyId, title: 'Endpoint', role: 'backend' })
    for (const status of ['refinement', 'ready']) {
      await call('PATCH', `/items/${storyId}`, { status })
      await call('PATCH', `/items/${epicId}`, { status })
    }
    expect((await call('POST', `/items/${epicId}/publish`)).status).toBe(200)
    const draftEpicId = id(await call('POST', '/items', { kind: 'epic', title: 'Draft epic', sourceDocumentId: prdId }), 'item')
    const draftStoryId = id(await call('POST', '/items', { kind: 'story', parentId: draftEpicId, title: 'Draft story', acceptanceCriteria: 'ok', sourceDocumentId: prdId }), 'item')
    await call('POST', '/task-drafts', { storyId: draftStoryId, title: 'Draft task', role: 'backend' })
    return { owner, workspaceId, brdId, prdId, reviewPrdId, epicId, storyId, draftEpicId, draftStoryId }
  }

  function read(account: TestAccount, workspaceId: string, path: string) {
    return http.call('GET', `/api/workspaces/${workspaceId}/planning${path}`, { token: account.token })
  }

  async function documentIds(account: TestAccount, workspaceId: string) {
    return ((await read(account, workspaceId, '/documents')).json.data as { documents: Doc[] }).documents.map((doc) => doc.id).sort()
  }

  test('backend reads the BRD and approved PRDs only, and other roles read no documents', async () => {
    const w = await workspace('access-docs')
    const backend = await member(w.owner, w.workspaceId, 'docs-backend', 'backend')
    const frontend = await member(w.owner, w.workspaceId, 'docs-frontend', 'frontend')
    const noRole = await member(w.owner, w.workspaceId, 'docs-norole', null)

    expect(await documentIds(backend, w.workspaceId)).toEqual([w.brdId, w.prdId].sort())
    expect((await read(backend, w.workspaceId, `/documents/${w.brdId}`)).status).toBe(200)
    expect((await read(backend, w.workspaceId, `/documents/${w.reviewPrdId}`)).status).toBe(404)
    expect(((await read(backend, w.workspaceId, '/documents')).json.data as { canReadDocuments: boolean }).canReadDocuments).toBe(true)
    for (const account of [frontend, noRole]) {
      expect(((await read(account, w.workspaceId, '/documents')).json.data as { canReadDocuments: boolean }).canReadDocuments).toBe(false)
      expect(await documentIds(account, w.workspaceId)).toEqual([])
      expect((await read(account, w.workspaceId, `/documents/${w.prdId}`)).status).toBe(404)
    }
  })

  test('the tech lead also reads PRDs in team review, which it approves', async () => {
    const w = await workspace('access-lead')
    const lead = await member(w.owner, w.workspaceId, 'docs-lead', 'tech_lead')

    expect(await documentIds(lead, w.workspaceId)).toEqual([w.brdId, w.prdId, w.reviewPrdId].sort())
  })

  test('every member reads all published epics, stories, and tasks, but no drafts', async () => {
    const w = await workspace('access-items')
    for (const discipline of ['ui_ux', 'frontend', 'mobile', 'qa', null]) {
      const account = await member(w.owner, w.workspaceId, `items-${discipline ?? 'none'}`, discipline)

      const listed = (await read(account, w.workspaceId, '/items')).json.data as { items: Item[]; tasks: Task[] }
      expect(listed.items.map((item) => item.id).sort()).toEqual([w.epicId, w.storyId].sort())
      expect(listed.tasks).toHaveLength(2)
      expect((await read(account, w.workspaceId, `/stories/${w.storyId}`)).status).toBe(200)
      expect((await read(account, w.workspaceId, `/stories/${w.draftStoryId}`)).status).toBe(404)
    }
  })

  test('a member reads the discussion of a published story, but only participants write in it', async () => {
    const w = await workspace('access-comments')
    const frontend = await member(w.owner, w.workspaceId, 'comments-frontend', 'frontend')
    await http.call('POST', `/api/workspaces/${w.workspaceId}/planning/story/${w.storyId}/comments`, { token: w.owner.token, body: { body: 'Scope is fixed.' } })

    expect((await read(frontend, w.workspaceId, `/story/${w.storyId}/comments`)).status).toBe(200)
    const write = await http.call('POST', `/api/workspaces/${w.workspaceId}/planning/story/${w.storyId}/comments`, { token: frontend.token, body: { body: 'Hi' } })
    expect(write.status).toBe(403)
  })

  test('agents follow the same rules: backend lists documents, every key lists published work', async () => {
    const w = await workspace('access-mcp')
    const backend = await member(w.owner, w.workspaceId, 'mcp-access-backend', 'backend')
    const designer = await member(w.owner, w.workspaceId, 'mcp-access-designer', 'ui_ux')
    const backendKey = await keyFor(backend, 'backend')
    const designerKey = await keyFor(designer, 'ui_ux')
    const tool = (key: string, name: string, args: Record<string, unknown> = {}) => http.mcp(key, 'tools/call', { name, arguments: { workspaceId: w.workspaceId, ...args } })

    const docs = toolResult(await tool(backendKey, 'documents_list'))
    expect((docs.value as Doc[]).map((doc) => doc.id).sort()).toEqual([w.brdId, w.prdId].sort())
    expect(toolResult(await tool(backendKey, 'documents_read', { documentId: w.prdId })).value).toMatchObject({ id: w.prdId, content: 'Product' })
    expect(toolResult(await tool(backendKey, 'documents_read', { documentId: w.reviewPrdId }))).toMatchObject({ isError: true, value: { code: 'PLANNING_NOT_FOUND' } })
    expect(toolResult(await tool(designerKey, 'documents_list'))).toMatchObject({ isError: true, value: { code: 'MCP_PERMISSION_DENIED' } })

    for (const key of [backendKey, designerKey]) {
      const items = toolResult(await tool(key, 'project_items_list')).value as Item[]
      expect(items.map((item) => item.id).sort()).toEqual([w.epicId, w.storyId].sort())
      expect(toolResult(await tool(key, 'project_tasks_list')).value).toHaveLength(2)
      expect(toolResult(await tool(key, 'story_read', { storyId: w.storyId })).isError).toBe(false)
    }
  })

  test('changes reach the same people who may read them', async () => {
    const w = await workspace('access-audience')
    const backend = await member(w.owner, w.workspaceId, 'audience2-backend', 'backend')
    const lead = await member(w.owner, w.workspaceId, 'audience2-lead', 'tech_lead')
    const frontend = await member(w.owner, w.workspaceId, 'audience2-frontend', 'frontend')
    const sorted = (ids: string[]) => [...ids].sort()

    expect(sorted(await planningAudience(db, w.workspaceId, { kind: 'document', id: w.prdId }))).toEqual(sorted([w.owner.user.id, backend.user.id, lead.user.id]))
    expect(sorted(await planningAudience(db, w.workspaceId, { kind: 'document', id: w.reviewPrdId }))).toEqual(sorted([w.owner.user.id, lead.user.id]))
    expect(await planningAudience(db, w.workspaceId, { kind: 'item', id: w.storyId })).toEqual(expect.arrayContaining([frontend.user.id, backend.user.id]))
    expect(await planningAudience(db, w.workspaceId, { kind: 'item', id: w.draftStoryId })).toEqual([w.owner.user.id])
  })
})
