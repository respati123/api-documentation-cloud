import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { notify } from '@/services/notifications'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'

const PRD_CONTENT = ['Summary', 'Problem', 'Goals', 'Users', 'Flows', 'Requirements'].map((heading) => `## ${heading}\nText.`).join('\n\n')

type KeyView = { id: string; name: string; status: string; keySuffix: string; expiresAt: string | null }
type ToolResult = { content: Array<{ text: string }>; isError: boolean }

describe.skipIf(!databaseEnabled)('member MCP keys', () => {
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

  // An owner with a workspace, and a member invited as an editor with the given project roles.
  async function team(label: string, roles: string[]) {
    const owner = await http.signUp(`${label}-owner`)
    const workspaceId = await http.createWorkspace(owner, `${label} space`)
    const member = await http.signUp(label)
    await http.inviteAndAccept(owner, workspaceId, member, 'editor')
    await setRoles(owner, workspaceId, member, roles)
    return { owner, member, workspaceId }
  }

  async function setRoles(owner: TestAccount, workspaceId: string, member: TestAccount, disciplines: string[]) {
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
    const projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
    return http.call('POST', `/api/workspaces/${workspaceId}/projects/${projectId}/members`, { token: owner.token, body: { userId: member.user.id, disciplines } })
  }

  function create(account: TestAccount, body: Record<string, unknown> = {}) {
    return http.call('POST', '/api/me/mcp-keys', { token: account.token, body: { name: 'Laptop', validDays: 90, ...body } })
  }

  async function secretFor(account: TestAccount) {
    return ((await create(account)).json.data as { secret: string }).secret
  }

  function toolResult(response: { json: Record<string, unknown> }) {
    const result = response.json.result as ToolResult
    return { isError: result.isError, value: JSON.parse(result.content[0].text) as Record<string, unknown> & unknown[] }
  }

  async function toolNames(secret: string) {
    return ((await http.mcp(secret, 'tools/list')).json.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name)
  }

  test('a member creates a key: the secret is shown once and not cached, and the list keeps only its last four characters', async () => {
    const { member } = await team('create', ['backend'])

    const created = await create(member, { name: 'Laptop kerja' })
    const { secret, key } = created.json.data as { secret: string; key: KeyView }
    const listed = await http.call('GET', '/api/me/mcp-keys', { token: member.token })

    expect(created.status).toBe(201)
    expect(created.headers.get('Cache-Control')).toBe('no-store')
    expect(secret.startsWith('apm_')).toBe(true)
    expect(key).toMatchObject({ name: 'Laptop kerja', status: 'active', keySuffix: secret.slice(-4) })
    expect(new Date(String(key.expiresAt)).getTime()).toBeGreaterThan(Date.now() + 89 * 86_400_000)
    expect(JSON.stringify(listed.json)).not.toContain(secret)
    expect(listed.json.data).toMatchObject({ limit: 10, keys: [{ id: key.id }] })
  })

  test('a key may have no expiry, and the name and validity are checked', async () => {
    const { member } = await team('expiry', [])

    const forever = await create(member, { validDays: null })
    expect((forever.json.data as { key: KeyView }).key.expiresAt).toBeNull()
    expect((await create(member, { validDays: 45 })).json.code).toBe('MCP_KEY_INPUT_INVALID')
    expect((await create(member, { name: '  ' })).json.code).toBe('MCP_KEY_INPUT_INVALID')
  })

  test('a member holds at most ten active keys', async () => {
    const { member } = await team('limit', [])
    for (let index = 0; index < 10; index += 1) expect((await create(member, { name: `Key ${index}` })).status).toBe(201)

    const refused = await create(member, { name: 'Eleventh' })

    expect(refused.status).toBe(409)
    expect(refused.json.code).toBe('MCP_KEY_LIMIT_REACHED')
  })

  test('a member revokes their own key, which stops the secret, and cannot revoke someone else’s', async () => {
    const { member } = await team('revoke', [])
    const { member: other } = await team('revoke-other', [])
    const { secret, key } = (await create(member)).json.data as { secret: string; key: KeyView }

    expect((await http.call('DELETE', `/api/me/mcp-keys/${key.id}`, { token: other.token })).json.code).toBe('MCP_KEY_NOT_FOUND')
    expect((await http.mcp(secret, 'tools/list')).status).toBe(200)
    expect((await http.call('DELETE', `/api/me/mcp-keys/${key.id}`, { token: member.token })).status).toBe(204)
    expect((await http.mcp(secret, 'tools/list')).status).toBe(401)
  })

  test('the tools follow the roles: backend and QA together get both, and nothing from other roles', async () => {
    const { member } = await team('roles', ['backend', 'qa'])

    const names = await toolNames(await secretFor(member))

    expect(names).toEqual(expect.arrayContaining(['story_link_api_contract', 'documents_read', 'story_write_test_case', 'workspaces_list']))
    expect(names).not.toContain('story_attach_design')
    expect(names).not.toContain('planning_draft_prd')
  })

  test('a member without a role gets the member tools only', async () => {
    const { member } = await team('no-role', [])

    const names = await toolNames(await secretFor(member))

    expect(names).toContain('issues_list')
    expect(names).not.toContain('story_link_api_contract')
    expect(names).not.toContain('planning_list')
  })

  test('a role from one workspace does not carry over: a backend tool is refused where the member is only QA', async () => {
    const { member, workspaceId: backendSpace } = await team('scope', ['backend'])
    const other = await http.signUp('scope-other-owner')
    const qaSpace = await http.createWorkspace(other, 'QA space')
    await http.inviteAndAccept(other, qaSpace, member, 'editor')
    await setRoles(other, qaSpace, member, ['qa'])
    const secret = await secretFor(member)
    await http.mcp(secret, 'tools/call', { name: 'planning_guide', arguments: {} })
    const docs = async (workspaceId: string) => toolResult(await http.mcp(secret, 'tools/call', { name: 'documents_list', arguments: { workspaceId } }))

    expect((await docs(backendSpace)).isError).toBe(false)
    expect(await docs(qaSpace)).toMatchObject({ isError: true, value: { code: 'MCP_PERMISSION_DENIED' } })
  })

  test('changing a role in the Team tab changes what an existing key may do, without a new key', async () => {
    const { owner, member, workspaceId } = await team('change', ['frontend'])
    const secret = await secretFor(member)
    expect(await toolNames(secret)).not.toContain('story_attach_design')

    await setRoles(owner, workspaceId, member, ['ui_ux'])

    expect(await toolNames(secret)).toContain('story_attach_design')
  })

  test('a workspace the member is not in is refused', async () => {
    const { member } = await team('foreign', ['backend'])
    const stranger = await http.signUp('foreign-stranger')
    const foreignId = await http.createWorkspace(stranger, 'Foreign space')

    const result = toolResult(await http.mcp(await secretFor(member), 'tools/call', { name: 'issues_list', arguments: { workspaceId: foreignId } }))

    expect(result).toMatchObject({ isError: true, value: { code: 'WORKSPACE_NOT_FOUND' } })
  })

  test('a PM drafts a PRD only after reading the guide, and a PRD without the template sections is refused', async () => {
    const { owner, member: pm, workspaceId } = await team('pm', ['pm'])
    const brd = await http.call('POST', `/api/workspaces/${workspaceId}/planning/documents`, { token: owner.token, body: { kind: 'brd', title: 'BRD', content: 'Needs' } })
    const brdId = (brd.json.data as { document: { id: string } }).document.id
    const secret = await secretFor(pm)
    const draft = (content: string) => http.mcp(secret, 'tools/call', { name: 'planning_draft_prd', arguments: { workspaceId, title: 'PRD', content, sourceDocumentId: brdId } })

    expect(toolResult(await draft(PRD_CONTENT))).toMatchObject({ isError: true, value: { code: 'MCP_GUIDE_REQUIRED' } })
    await http.mcp(secret, 'tools/call', { name: 'planning_guide', arguments: {} })
    expect(toolResult(await draft('Just a paragraph.'))).toMatchObject({ isError: true, value: { code: 'MCP_DRAFT_INCOMPLETE' } })
    expect(toolResult(await draft(PRD_CONTENT)).isError).toBe(false)
  })

  test('a viewer stays read-only through MCP, even with the PM role', async () => {
    const owner = await http.signUp('viewer-owner')
    const workspaceId = await http.createWorkspace(owner, 'viewer space')
    const viewer = await http.signUp('viewer-pm')
    await http.inviteAndAccept(owner, workspaceId, viewer, 'viewer')
    await setRoles(owner, workspaceId, viewer, ['pm'])
    const brd = await http.call('POST', `/api/workspaces/${workspaceId}/planning/documents`, { token: owner.token, body: { kind: 'brd', title: 'BRD', content: 'Needs' } })
    const brdId = (brd.json.data as { document: { id: string } }).document.id
    const secret = await secretFor(viewer)
    await http.mcp(secret, 'tools/call', { name: 'planning_guide', arguments: {} })
    const call = (name: string, args: Record<string, unknown>) => http.mcp(secret, 'tools/call', { name, arguments: { workspaceId, ...args } })

    expect(toolResult(await call('planning_draft_prd', { title: 'PRD', content: PRD_CONTENT, sourceDocumentId: brdId }))).toMatchObject({ isError: true, value: { code: 'MCP_PERMISSION_DENIED' } })
    expect(toolResult(await call('planning_upload_brd', { title: 'BRD 2', content: 'Text' }))).toMatchObject({ isError: true, value: { code: 'MCP_PERMISSION_DENIED' } })
    expect(toolResult(await call('issues_list', {})).isError).toBe(false)
  })

  test('a PM uploads a BRD from markdown text after reading the guide', async () => {
    const { member: pm, workspaceId } = await team('brd', ['pm'])
    const secret = await secretFor(pm)
    const content = '# BRD Klinik\n\n## Masalah\nPasien menunggu lama.'
    const upload = (args: Record<string, unknown>) => http.mcp(secret, 'tools/call', { name: 'planning_upload_brd', arguments: { workspaceId, title: 'BRD Klinik', content, ...args } })

    expect(toolResult(await upload({}))).toMatchObject({ isError: true, value: { code: 'MCP_GUIDE_REQUIRED' } })
    await http.mcp(secret, 'tools/call', { name: 'planning_guide', arguments: {} })
    expect(toolResult(await upload({ fileName: 'brd.pdf' }))).toMatchObject({ isError: true, value: { code: 'PLANNING_INPUT_INVALID' } })
    expect(toolResult(await upload({ fileName: 'brd-klinik.md' })).value).toMatchObject({ kind: 'brd', status: 'draft', fileName: 'brd-klinik.md' })
  })

  test('the server hands the agent its playbook for every role it holds, with PM prompts for a PM', async () => {
    const { member } = await team('guide', ['pm', 'qa'])
    const secret = await secretFor(member)

    const init = await http.mcp(secret, 'initialize', {})
    expect((init.json.result as { instructions: string }).instructions).toContain('"pm", "qa" roles')
    const guide = toolResult(await http.mcp(secret, 'tools/call', { name: 'planning_guide', arguments: {} }))
    expect(guide.value).toMatchObject({ roles: ['pm', 'qa'] })
    expect(String(guide.value.guide)).toContain('Step 5')
    expect(String(guide.value.guide)).toContain('Playbook for the QA agent')
    const prompts = (await http.mcp(secret, 'prompts/list')).json.result as { prompts: Array<{ name: string }> }
    expect(prompts.prompts.map((prompt) => prompt.name)).toContain('pm_brd_to_prd')
  })

  test('the portal shows the member their access per workspace and the playbook for their roles', async () => {
    const { member, workspaceId } = await team('access', ['qa'])

    const access = (await http.call('GET', '/api/me/mcp-access', { token: member.token })).json.data as { workspaces: Array<{ id: string; roles: string[]; tools: string[] }> }
    const guide = ((await http.call('GET', '/api/me/mcp-guide', { token: member.token })).json.data as { guide: { roles: string[]; guide: string } }).guide

    expect(access.workspaces).toEqual([expect.objectContaining({ id: workspaceId, roles: ['qa'] })])
    expect(access.workspaces[0]?.tools).toContain('story_write_test_case')
    expect(guide.roles).toEqual(['qa'])
    expect(guide.guide).toContain('story_write_test_case')
  })

  test('leaving the last workspace revokes the member’s keys', async () => {
    const { member, workspaceId } = await team('leave', [])
    const secret = await secretFor(member)

    await http.call('DELETE', `/api/workspaces/${workspaceId}/members/${member.user.id}`, { token: member.token })

    expect((await http.mcp(secret, 'tools/list')).status).toBe(401)
  })

  test('the admin lists every key with its owner and revokes one, and an ordinary account cannot', async () => {
    const { member } = await team('admin-list', [])
    const { secret, key } = (await create(member, { name: 'Server CI' })).json.data as { secret: string; key: KeyView }

    expect((await http.call('GET', '/api/admin/mcp-keys', { token: member.token })).json.code).toBe('ADMIN_REQUIRED')
    const listed = await http.call('GET', `/api/admin/mcp-keys?q=${encodeURIComponent(member.user.email)}`, { token: admin.token })
    expect(listed.json.data).toMatchObject({ keys: [{ id: key.id, name: 'Server CI', owner: { email: member.user.email } }] })
    expect(JSON.stringify(listed.json)).not.toContain(secret)

    expect((await http.call('DELETE', `/api/admin/mcp-keys/${key.id}`, { token: admin.token })).status).toBe(204)
    expect((await http.mcp(secret, 'tools/list')).status).toBe(401)
  })

  test('the old claim and admin-issue endpoints are gone', async () => {
    const { member } = await team('gone', [])

    expect((await http.call('POST', '/api/admin/mcp-keys', { token: admin.token, body: { userId: member.user.id, name: 'x', role: 'qa', validDays: 30 } })).json.code).toBe('ROUTE_NOT_FOUND')
    expect((await http.call('POST', '/api/me/mcp-key/any/claim', { token: member.token, body: {} })).json.code).toBe('ROUTE_NOT_FOUND')
  })

  test('/api/me tells the portal whether the account is the admin', async () => {
    const { member } = await team('me-flag', [])

    expect(((await http.call('GET', '/api/me', { token: admin.token })).json.data as { user: { isAdmin: boolean } }).user.isAdmin).toBe(true)
    expect(((await http.call('GET', '/api/me', { token: member.token })).json.data as { user: { isAdmin: boolean } }).user.isAdmin).toBe(false)
  })

  test('the member marks notifications read', async () => {
    const { member } = await team('read', [])
    await notify(db, member.user.id, 'task_assigned', '/w/x/projects', { actor: 'rani', title: 'Task' })
    const list = await http.call('GET', '/api/me/notifications', { token: member.token })
    const id = (list.json.data as { notifications: Array<{ id: string }> }).notifications[0].id

    expect((await http.call('POST', `/api/me/notifications/${id}/read`, { token: member.token })).status).toBe(204)
    expect(((await http.call('GET', '/api/me/notifications', { token: member.token })).json.data as { unreadCount: number }).unreadCount).toBe(0)
  })
})

