import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { MCP_CALLS_PER_MINUTE } from '@/routes/mcp'
import { notify } from '@/services/notifications'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'

const PRD_CONTENT = ['Summary', 'Problem', 'Goals', 'Users', 'Flows', 'Requirements'].map((heading) => `## ${heading}\nText.`).join('\n\n')
const TREE = [
  { id: 'req-login', kind: 'request', name: 'Login', method: 'POST', url: '{{baseUrl}}/auth/login', body: '' },
  { id: 'folder-orders', kind: 'folder', name: 'Orders', children: [{ id: 'req-orders', kind: 'request', name: 'List orders', method: 'GET', url: '{{baseUrl}}/orders', body: '' }] },
]

type ToolResult = { content: Array<{ text: string }>; isError: boolean; structuredContent?: Record<string, unknown> }
type Tool = { name: string; title?: string; annotations?: Record<string, boolean> }

// The MCP endpoint itself: the JSON-RPC protocol, tool metadata, and the agent conveniences around the tools.
describe.skipIf(!databaseEnabled)('MCP endpoint', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
  })

  afterAll(async () => {
    await db.close()
  })

  async function team(label: string, roles: string[]) {
    const owner = await http.signUp(`${label}-owner`)
    const made = await http.call('POST', '/api/workspaces', { token: owner.token, body: { name: `${label} space`, tree: TREE, variables: { globals: [], environments: [] } } })
    const workspaceId = (made.json.data as { workspace: { id: string } }).workspace.id
    const member = await http.signUp(label)
    await http.inviteAndAccept(owner, workspaceId, member, 'editor')
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
    const projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
    await http.call('POST', `/api/workspaces/${workspaceId}/projects/${projectId}/members`, { token: owner.token, body: { userId: member.user.id, disciplines: roles } })
    const created = await http.call('POST', '/api/me/mcp-keys', { token: member.token, body: { name: 'Laptop', validDays: 30 } })
    return { owner, member, workspaceId, secret: (created.json.data as { secret: string }).secret }
  }

  function tool(secret: string, name: string, args: Record<string, unknown> = {}) {
    return http.mcp(secret, 'tools/call', { name, arguments: args })
  }

  function result(response: { json: Record<string, unknown> }) {
    const value = response.json.result as ToolResult
    return { isError: value.isError, value: JSON.parse(value.content[0].text), structured: value.structuredContent }
  }

  async function brd(owner: TestAccount, workspaceId: string) {
    const created = await http.call('POST', `/api/workspaces/${workspaceId}/planning/documents`, { token: owner.token, body: { kind: 'brd', title: 'BRD', content: 'Needs' } })
    return (created.json.data as { document: { id: string } }).document.id
  }

  describe('protocol', () => {
    test('a refused key gets a JSON-RPC error an agent can read, with status 401 and a Bearer challenge', async () => {
      const response = await http.mcpRaw('apm_not-a-real-key', { jsonrpc: '2.0', id: 7, method: 'tools/list' })

      expect(response.status).toBe(401)
      expect(response.headers.get('WWW-Authenticate')).toContain('Bearer')
      expect(response.json).toMatchObject({ jsonrpc: '2.0', id: 7, error: { code: -32001, data: { code: 'MCP_KEY_INVALID' } } })
      expect(String((response.json.error as { message: string }).message).length).toBeGreaterThan(0)
      expect((await http.mcpRaw(undefined, { jsonrpc: '2.0', id: 8, method: 'ping' })).json).toMatchObject({ id: 8, error: { data: { code: 'MCP_KEY_INVALID' } } })
    })

    test('every notification is accepted with 202 and no body', async () => {
      const { secret } = await team('notify', [])

      for (const method of ['notifications/initialized', 'notifications/cancelled', 'notifications/roots/list_changed']) {
        const response = await http.mcpRaw(secret, { jsonrpc: '2.0', method, params: { requestId: 1 } })
        expect(response.status).toBe(202)
        expect(response.text).toBe('')
      }
    })

    test('initialize answers with the version the client asked for when supported, and the latest otherwise', async () => {
      const { secret } = await team('version', [])
      const init = async (protocolVersion: string) => ((await http.mcp(secret, 'initialize', { protocolVersion })).json.result as { protocolVersion: string; capabilities: Record<string, unknown> })

      expect((await init('2025-03-26')).protocolVersion).toBe('2025-03-26')
      expect((await init('2025-06-18')).protocolVersion).toBe('2025-06-18')
      expect((await init('2024-01-01')).protocolVersion).toBe('2025-06-18')
      expect((await init('2025-06-18')).capabilities).toMatchObject({ tools: {}, prompts: {}, resources: {} })
    })

    test('an unsupported MCP-Protocol-Version header is refused with 400', async () => {
      const { secret } = await team('header', [])

      const refused = await http.mcpRaw(secret, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { 'MCP-Protocol-Version': '1999-01-01' })
      const accepted = await http.mcpRaw(secret, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { 'MCP-Protocol-Version': '2025-06-18' })

      expect(refused.status).toBe(400)
      expect(refused.json).toMatchObject({ id: 1, error: { code: -32600, data: { supported: ['2025-06-18', '2025-03-26'] } } })
      expect(accepted.status).toBe(200)
    })

    test('a key making too many calls in a minute is slowed down', async () => {
      const { secret } = await team('rate', [])
      for (let index = 0; index < MCP_CALLS_PER_MINUTE; index += 1) await http.mcpRaw(secret, { jsonrpc: '2.0', id: index, method: 'ping' })

      const refused = await http.mcpRaw(secret, { jsonrpc: '2.0', id: 'last', method: 'ping' })

      expect(refused.status).toBe(429)
      expect(refused.json).toMatchObject({ id: 'last', error: { data: { code: 'MCP_RATE_LIMITED' } } })
    })

    test('the key records its last use at most once a minute', async () => {
      const { secret, member } = await team('touch', [])
      const lastUsed = async () => {
        const [row] = await db`SELECT last_used_at AS "lastUsedAt" FROM mcp_keys WHERE user_id = ${member.user.id}`
        return new Date(row.lastUsedAt).getTime()
      }
      await http.mcp(secret, 'ping')
      const first = await lastUsed()
      await Bun.sleep(5)
      await http.mcp(secret, 'ping')

      expect(await lastUsed()).toBe(first)
    })
  })

  describe('tools', () => {
    test('tools/list carries a title and hints: reads are read-only, drafts only add', async () => {
      const { secret } = await team('hints', ['pm'])

      const tools = ((await http.mcp(secret, 'tools/list')).json.result as { tools: Tool[] }).tools
      const byName = Object.fromEntries(tools.map((item) => [item.name, item]))

      expect(byName.documents_read.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false })
      expect(byName.planning_draft_prd.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false })
      expect(byName.story_write_details.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: true })
      expect(tools.every((item) => typeof item.title === 'string' && item.title.length > 0)).toBe(true)
    })

    test('the removed duplicate tools are neither listed nor answered', async () => {
      const { owner, workspaceId, secret } = await team('slim', ['pm'])
      const brdId = await brd(owner, workspaceId)

      const names = ((await http.mcp(secret, 'tools/list')).json.result as { tools: Tool[] }).tools.map((item) => item.name)

      for (const gone of ['projects_list', 'stories_read_participating', 'planning_read_document']) expect(names).not.toContain(gone)
      expect(names).toEqual(expect.arrayContaining(['documents_list', 'documents_read', 'planning_list', 'story_read']))
      for (const gone of ['projects_list', 'stories_read_participating', 'planning_read_document']) {
        const refused = await tool(secret, gone, { workspaceId, documentId: brdId })
        expect(refused.json.error).toMatchObject({ code: -32602 })
      }
      expect(result(await tool(secret, 'documents_read', { workspaceId, documentId: brdId })).value).toMatchObject({ id: brdId })
    })

    test('a result also comes as structured content, with a list wrapped in items', async () => {
      const { workspaceId, secret } = await team('structured', [])

      const listed = result(await tool(secret, 'workspaces_list'))

      expect(listed.structured).toEqual({ items: listed.value })
      expect((listed.value as Array<{ id: string }>).map((row) => row.id)).toContain(workspaceId)
    })

    test('a write refused for the guide carries the guide, so the retry succeeds without another call', async () => {
      const { owner, workspaceId, secret } = await team('guide-inline', ['pm'])
      const brdId = await brd(owner, workspaceId)
      const draft = () => tool(secret, 'planning_draft_prd', { workspaceId, title: 'PRD', content: PRD_CONTENT, sourceDocumentId: brdId })

      const refused = result(await draft())

      expect(refused).toMatchObject({ isError: true, value: { code: 'MCP_GUIDE_REQUIRED' } })
      expect(String(refused.value.guide.guide)).toContain('Planning playbook for the PM agent')
      expect(result(await draft()).isError).toBe(false)
    })

    test('a draft sent twice with the same clientRequestId is created once', async () => {
      const { owner, workspaceId, secret } = await team('replay', ['pm'])
      const brdId = await brd(owner, workspaceId)
      await tool(secret, 'planning_guide')
      const draft = (clientRequestId: string) => tool(secret, 'planning_draft_prd', { workspaceId, title: 'PRD', content: PRD_CONTENT, sourceDocumentId: brdId, clientRequestId })

      const first = result(await draft('prd-1'))
      const again = result(await draft('prd-1'))
      const other = result(await draft('prd-2'))

      expect(again.value.id).toBe(first.value.id)
      expect(other.value.id).not.toBe(first.value.id)
      const documents = result(await tool(secret, 'documents_list', { workspaceId })).value as Array<{ kind: string }>
      expect(documents.filter((row) => row.kind === 'prd')).toHaveLength(2)
    })

    test('api_requests_search finds requests in the workspace API docs by name, path, or method', async () => {
      const { workspaceId, secret } = await team('search', ['backend'])

      const byPath = result(await tool(secret, 'api_requests_search', { workspaceId, query: 'orders' })).value
      const byMethod = result(await tool(secret, 'api_requests_search', { workspaceId, method: 'post' })).value
      const all = result(await tool(secret, 'api_requests_search', { workspaceId })).value

      expect(byPath).toEqual([{ id: 'req-orders', name: 'List orders', method: 'GET', url: '{{baseUrl}}/orders', path: '/orders', folder: 'Orders' }])
      expect(byMethod.map((row: { id: string }) => row.id)).toEqual(['req-login'])
      expect(all).toHaveLength(2)
    })

    test('notifications_list and notifications_mark_read let the agent follow what needs the member', async () => {
      const { member, secret } = await team('inbox', [])
      await notify(db, member.user.id, 'task_comment', '/w/x/projects', { actor: 'rani', preview: 'Ready?' })

      const unread = result(await tool(secret, 'notifications_list', { unreadOnly: true })).value as { items: Array<{ id: string; kind: string }>; unreadCount: number }
      expect(unread).toMatchObject({ unreadCount: 1, items: [{ kind: 'task_comment' }] })
      expect(result(await tool(secret, 'notifications_mark_read', { ids: [unread.items[0].id] })).isError).toBe(false)
      expect(result(await tool(secret, 'notifications_list', { unreadOnly: true })).value).toMatchObject({ unreadCount: 0, items: [] })
    })
  })

  describe('discussion', () => {
    const handle = (account: TestAccount) => account.user.email.split('@')[0]

    test('team_members_list shows every member with the handle to mention and their roles', async () => {
      const { owner, member, workspaceId, secret } = await team('roster', ['backend', 'qa'])

      const members = result(await tool(secret, 'team_members_list', { workspaceId })).value as Array<Record<string, unknown>>

      expect(members).toContainEqual({ id: member.user.id, handle: handle(member), email: member.user.email, workspaceRole: 'editor', projectRoles: ['backend', 'qa'] })
      expect(members).toContainEqual(expect.objectContaining({ id: owner.user.id, handle: handle(owner), workspaceRole: 'owner' }))
    })

    test('a comment that names @handle notifies that member, and says which handles matched no one', async () => {
      const { owner, workspaceId, secret } = await team('mention', ['pm'])
      const brdId = await brd(owner, workspaceId)
      await tool(secret, 'planning_guide')

      const sent = result(await tool(secret, 'planning_comment', { workspaceId, targetKind: 'document', targetId: brdId, body: `@${handle(owner)} tolong cek target KPI. cc @nobody-here` }))

      expect(sent).toMatchObject({ isError: false, value: { mentioned: [handle(owner)], unknownMentions: ['nobody-here'] } })
      const inbox = await http.call('GET', '/api/me/notifications', { token: owner.token })
      expect(JSON.stringify(inbox.json.data)).toContain('comment_mention')
    })

    test('discussion_read returns threads with replies, and a reply with parentId notifies the author it answers', async () => {
      const { owner, member, workspaceId, secret } = await team('thread', ['pm'])
      const brdId = await brd(owner, workspaceId)
      const asked = await http.call('POST', `/api/workspaces/${workspaceId}/planning/document/${brdId}/comments`, { token: owner.token, body: { body: 'Siapa approver BRD ini?' } })
      const questionId = (asked.json.data as { comment?: { id: string }; id?: string }).comment?.id ?? (asked.json.data as { id: string }).id
      await tool(secret, 'planning_guide')

      const reply = result(await tool(secret, 'planning_comment', { workspaceId, targetKind: 'document', targetId: brdId, body: 'Sponsor dan Finance.', parentId: questionId }))
      const threads = result(await tool(secret, 'discussion_read', { workspaceId, targetKind: 'document', targetId: brdId })).value as Array<Record<string, unknown>>

      expect(reply.isError).toBe(false)
      expect(threads).toHaveLength(1)
      expect(threads[0]).toMatchObject({ id: questionId, author: handle(owner), body: 'Siapa approver BRD ini?', resolved: false, replies: [{ author: handle(member), body: 'Sponsor dan Finance.' }] })
      const inbox = await http.call('GET', '/api/me/notifications', { token: owner.token })
      expect(JSON.stringify(inbox.json.data)).toContain('comment_reply')
    })

    test('discussion_read refuses a target the key may not read', async () => {
      const { owner, workspaceId, secret } = await team('thread-hidden', ['frontend'])
      const brdId = await brd(owner, workspaceId)

      expect(result(await tool(secret, 'discussion_read', { workspaceId, targetKind: 'document', targetId: brdId }))).toMatchObject({ isError: true, value: { code: 'PLANNING_NOT_FOUND' } })
    })
  })

  describe('BRD from an agent', () => {
    test('waits as a draft until an approver confirms it in the web app, and no PRD is drafted from it before', async () => {
      const { owner, workspaceId, secret } = await team('brd-confirm', ['pm'])
      await tool(secret, 'planning_guide')

      const uploaded = result(await tool(secret, 'planning_upload_brd', { workspaceId, title: 'BRD Klinik', content: '# BRD', fileName: 'brd.md' })).value
      expect(uploaded).toMatchObject({ kind: 'brd', status: 'draft' })
      const prd = result(await tool(secret, 'planning_draft_prd', { workspaceId, title: 'PRD', content: PRD_CONTENT, sourceDocumentId: uploaded.id }))
      expect(prd).toMatchObject({ isError: true, value: { code: 'PLANNING_CONFLICT' } })

      const confirmed = await http.call('POST', `/api/workspaces/${workspaceId}/planning/documents/${uploaded.id}/status`, { token: owner.token, body: { status: 'approved' } })
      expect(confirmed.status).toBe(200)
      expect((confirmed.json.data as { document: { status: string } }).document.status).toBe('approved')
      expect(result(await tool(secret, 'planning_draft_prd', { workspaceId, title: 'PRD', content: PRD_CONTENT, sourceDocumentId: uploaded.id })).isError).toBe(false)
    })

    test('a draft BRD is hidden from backend until it is confirmed', async () => {
      const { owner, workspaceId, secret } = await team('brd-hidden', ['pm'])
      const backend = await http.signUp('brd-hidden-backend')
      await http.inviteAndAccept(owner, workspaceId, backend, 'editor')
      const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
      const projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
      await http.call('POST', `/api/workspaces/${workspaceId}/projects/${projectId}/members`, { token: owner.token, body: { userId: backend.user.id, disciplines: ['backend'] } })
      await tool(secret, 'planning_guide')
      const uploaded = result(await tool(secret, 'planning_upload_brd', { workspaceId, title: 'BRD', content: 'Text' })).value

      const visible = async () => ((await http.call('GET', `/api/workspaces/${workspaceId}/planning/documents`, { token: backend.token })).json.data as { documents: Array<{ id: string }> }).documents.map((row) => row.id)

      expect(await visible()).not.toContain(uploaded.id)
      await http.call('POST', `/api/workspaces/${workspaceId}/planning/documents/${uploaded.id}/status`, { token: owner.token, body: { status: 'approved' } })
      expect(await visible()).toContain(uploaded.id)
    })
  })

  describe('resources', () => {
    test('documents the key may read are resources the client can attach', async () => {
      const { owner, workspaceId, secret } = await team('resources', ['backend'])
      const brdId = await brd(owner, workspaceId)
      const uri = `apidocs://workspaces/${workspaceId}/documents/${brdId}`

      const listed = (await http.mcp(secret, 'resources/list')).json.result as { resources: Array<{ uri: string; name: string; mimeType: string }> }
      const read = (await http.mcp(secret, 'resources/read', { uri })).json.result as { contents: Array<{ uri: string; text: string; mimeType: string }> }
      const templates = (await http.mcp(secret, 'resources/templates/list')).json.result as { resourceTemplates: Array<{ uriTemplate: string }> }

      expect(listed.resources).toEqual(expect.arrayContaining([expect.objectContaining({ uri, name: 'BRD', mimeType: 'text/markdown' })]))
      expect(read.contents).toEqual([{ uri, mimeType: 'text/markdown', text: 'Needs' }])
      expect(templates.resourceTemplates[0].uriTemplate).toBe('apidocs://workspaces/{workspaceId}/documents/{documentId}')
    })

    test('a resource the key may not read is refused', async () => {
      const { owner, workspaceId, secret } = await team('resources-denied', ['frontend'])
      const brdId = await brd(owner, workspaceId)

      const listed = (await http.mcp(secret, 'resources/list')).json.result as { resources: unknown[] }
      const read = await http.mcp(secret, 'resources/read', { uri: `apidocs://workspaces/${workspaceId}/documents/${brdId}` })
      const malformed = await http.mcp(secret, 'resources/read', { uri: 'https://example.test/x' })

      expect(listed.resources).toEqual([])
      expect(read.json).toMatchObject({ error: { code: -32002 } })
      expect(malformed.json).toMatchObject({ error: { code: -32002 } })
    })
  })
})
