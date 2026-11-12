import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'

const PRD_CONTENT = ['Summary', 'Problem', 'Goals', 'Users', 'Flows', 'Requirements'].map((heading) => `## ${heading}\nText.`).join('\n\n')

type KeyView = { id: string; status: string; role: string; tools: string[] }
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

  async function memberWithWorkspace(label: string) {
    const member = await http.signUp(label)
    const workspaceId = await http.createWorkspace(member, `${label} space`)
    return { member, workspaceId }
  }

  async function issue(userId: string, body: Record<string, unknown> = {}) {
    return http.call('POST', '/api/admin/mcp-keys', { token: admin.token, body: { userId, name: 'Laptop', role: 'backend', validDays: 30, ...body } })
  }

  async function issueAndClaim(member: TestAccount, body: Record<string, unknown> = {}) {
    const issued = await issue(member.user.id, body)
    const keyId = (issued.json.data as { key: KeyView }).key.id
    const claimed = await http.call('POST', `/api/me/mcp-key/${keyId}/claim`, { token: member.token })
    return { keyId, claimed, secret: (claimed.json.data as { secret: string }).secret }
  }

  function toolResult(response: { json: Record<string, unknown> }) {
    const result = response.json.result as ToolResult
    return { isError: result.isError, value: JSON.parse(result.content[0].text) as Record<string, unknown> & unknown[] }
  }

  test('an ordinary account cannot use the admin endpoints', async () => {
    const { member } = await memberWithWorkspace('not-admin')

    const response = await http.call('GET', '/api/admin/mcp-keys', { token: member.token })

    expect(response.status).toBe(403)
    expect(response.json.code).toBe('ADMIN_REQUIRED')
  })

  test('/api/me tells the portal whether the account is the admin', async () => {
    const { member } = await memberWithWorkspace('me-flag')

    expect(((await http.call('GET', '/api/me', { token: admin.token })).json.data as { user: { isAdmin: boolean } }).user.isAdmin).toBe(true)
    expect(((await http.call('GET', '/api/me', { token: member.token })).json.data as { user: { isAdmin: boolean } }).user.isAdmin).toBe(false)
  })

  test('the admin creates a pending key without a secret, and the member gets a notification', async () => {
    const { member } = await memberWithWorkspace('pending')

    const response = await issue(member.user.id)

    expect(response.status).toBe(201)
    expect(JSON.stringify(response.json)).not.toContain('apm_')
    const key = (response.json.data as { key: KeyView }).key
    expect(key.status).toBe('pending')
    expect(key.tools).toContain('tasks_list_assigned')
    expect(key.tools).not.toContain('planning_draft_prd')
    const mine = await http.call('GET', '/api/me/mcp-key', { token: member.token })
    expect((mine.json.data as { key: KeyView }).key.id).toBe(key.id)
    const notifications = await http.call('GET', '/api/me/notifications', { token: member.token })
    const data = notifications.json.data as { notifications: Array<{ kind: string; link: string }>; unreadCount: number }
    expect(data.unreadCount).toBe(1)
    expect(data.notifications[0]).toMatchObject({ kind: 'mcp_key_ready', link: '/settings/mcp' })
  })

  test('the admin sees the member and the key status in the list', async () => {
    const { member } = await memberWithWorkspace('listed')
    await issue(member.user.id)

    const response = await http.call('GET', `/api/admin/mcp-keys?q=${encodeURIComponent(member.user.email)}`, { token: admin.token })

    const members = (response.json.data as { members: Array<{ userId: string; key: KeyView | null }> }).members
    expect(members).toHaveLength(1)
    expect(members[0].key?.status).toBe('pending')
  })

  test('a key cannot be made for an account outside every workspace, or with an unknown tool', async () => {
    const loner = await http.signUp('loner')
    const { member } = await memberWithWorkspace('bad-tool')

    expect((await issue(loner.user.id)).json.code).toBe('MCP_KEY_MEMBER_INVALID')
    expect((await issue(member.user.id, { tools: ['drop_database'] })).json.code).toBe('MCP_KEY_INPUT_INVALID')
  })

  test('the member claims the key once, the secret is not cached, and only that member can claim it', async () => {
    const { member } = await memberWithWorkspace('claim')
    const other = await http.signUp('claim-other')
    const keyId = ((await issue(member.user.id)).json.data as { key: KeyView }).key.id

    expect((await http.call('POST', `/api/me/mcp-key/${keyId}/claim`, { token: other.token })).json.code).toBe('MCP_KEY_NOT_FOUND')
    const claimed = await http.call('POST', `/api/me/mcp-key/${keyId}/claim`, { token: member.token })
    expect(claimed.status).toBe(201)
    expect(claimed.headers.get('Cache-Control')).toBe('no-store')
    expect((claimed.json.data as { secret: string }).secret).toStartWith('apm_')
    expect(((claimed.json.data as { key: KeyView }).key).status).toBe('active')
    const again = await http.call('POST', `/api/me/mcp-key/${keyId}/claim`, { token: member.token })
    expect(again.status).toBe(409)
    expect(again.json.code).toBe('MCP_KEY_CLAIM_UNAVAILABLE')
  })

  test('the key lists only its tools and works in every workspace of the member', async () => {
    const { member, workspaceId } = await memberWithWorkspace('tools')
    const owner = await http.signUp('tools-owner')
    const secondId = await http.createWorkspace(owner, 'Second space')
    await http.inviteAndAccept(owner, secondId, member, 'viewer')
    const { secret } = await issueAndClaim(member)

    const listed = await http.mcp(secret, 'tools/list')
    const names = ((listed.json.result as { tools: Array<{ name: string }> }).tools).map((tool) => tool.name)
    expect(names).toContain('workspaces_list')
    expect(names).not.toContain('planning_draft_prd')

    const workspaces = toolResult(await http.mcp(secret, 'tools/call', { name: 'workspaces_list', arguments: {} }))
    expect((workspaces.value as unknown as Array<{ id: string }>).map((workspace) => workspace.id).sort()).toEqual([workspaceId, secondId].sort())
    const projects = toolResult(await http.mcp(secret, 'tools/call', { name: 'projects_list', arguments: { workspaceId: secondId } }))
    expect(projects.isError).toBe(false)
  })

  test('a tool call for a workspace the member is not in, or a tool the key lacks, is refused', async () => {
    const { member } = await memberWithWorkspace('refused')
    const { workspaceId: foreignId } = await memberWithWorkspace('refused-foreign')
    const { secret } = await issueAndClaim(member, { tools: ['workspaces_list', 'projects_list'] })

    const foreign = toolResult(await http.mcp(secret, 'tools/call', { name: 'projects_list', arguments: { workspaceId: foreignId } }))
    expect(foreign).toMatchObject({ isError: true, value: { code: 'WORKSPACE_NOT_FOUND' } })
    const missing = toolResult(await http.mcp(secret, 'tools/call', { name: 'tasks_list_assigned', arguments: { workspaceId: foreignId } }))
    expect(missing).toMatchObject({ isError: true, value: { code: 'MCP_PERMISSION_DENIED' } })
  })

  test('a PM key drafts a PRD even where the member is only a viewer', async () => {
    const owner = await http.signUp('pm-owner')
    const workspaceId = await http.createWorkspace(owner, 'PM space')
    const pm = await http.signUp('pm-viewer')
    await http.inviteAndAccept(owner, workspaceId, pm, 'viewer')
    const brd = await http.call('POST', `/api/workspaces/${workspaceId}/planning/documents`, { token: owner.token, body: { kind: 'brd', title: 'BRD', content: 'Business needs' } })
    const brdId = (brd.json.data as { document: { id: string } }).document.id
    const { secret } = await issueAndClaim(pm, { role: 'pm' })

    await http.mcp(secret, 'tools/call', { name: 'planning_guide', arguments: {} })
    const drafted = toolResult(await http.mcp(secret, 'tools/call', { name: 'planning_draft_prd', arguments: { workspaceId, title: 'PRD', content: PRD_CONTENT, sourceDocumentId: brdId } }))

    expect(drafted.isError).toBe(false)
    expect(drafted.value).toMatchObject({ kind: 'prd', status: 'draft' })
  })

  test('a new key revokes the old one, and revoking stops the secret', async () => {
    const { member } = await memberWithWorkspace('rotate')
    const first = await issueAndClaim(member)
    const second = await issueAndClaim(member)

    expect((await http.mcp(first.secret, 'tools/list')).status).toBe(401)
    expect((await http.mcp(second.secret, 'tools/list')).status).toBe(200)

    expect((await http.call('DELETE', `/api/admin/mcp-keys/${second.keyId}`, { token: admin.token })).status).toBe(204)
    expect((await http.mcp(second.secret, 'tools/list')).status).toBe(401)
  })

  test('reissue makes a new pending key with the same settings', async () => {
    const { member } = await memberWithWorkspace('reissue')
    const { keyId } = await issueAndClaim(member, { role: 'qa', name: 'QA laptop' })

    const response = await http.call('POST', `/api/admin/mcp-keys/${keyId}/reissue`, { token: admin.token })

    const key = (response.json.data as { key: KeyView & { name: string } }).key
    expect(response.status).toBe(201)
    expect(key).toMatchObject({ status: 'pending', role: 'qa', name: 'QA laptop' })
  })

  test('leaving the last workspace revokes the key', async () => {
    const owner = await http.signUp('leave-owner')
    const workspaceId = await http.createWorkspace(owner, 'Leave space')
    const member = await http.signUp('leaver')
    await http.inviteAndAccept(owner, workspaceId, member, 'editor')
    const { secret } = await issueAndClaim(member)

    await http.call('DELETE', `/api/workspaces/${workspaceId}/members/${member.user.id}`, { token: member.token })

    expect((await http.mcp(secret, 'tools/list')).status).toBe(401)
  })

  test('the member marks notifications read', async () => {
    const { member } = await memberWithWorkspace('read')
    await issue(member.user.id)
    const list = await http.call('GET', '/api/me/notifications', { token: member.token })
    const id = (list.json.data as { notifications: Array<{ id: string }> }).notifications[0].id

    expect((await http.call('POST', `/api/me/notifications/${id}/read`, { token: member.token })).status).toBe(204)

    const after = await http.call('GET', '/api/me/notifications', { token: member.token })
    expect((after.json.data as { unreadCount: number }).unreadCount).toBe(0)
  })

  test('the server hands the agent its playbook: instructions on connect, the guide tool, and PM prompts', async () => {
    const { member } = await memberWithWorkspace('guide-pm')
    const { secret } = await issueAndClaim(member, { role: 'pm' })

    const init = await http.mcp(secret, 'initialize', {})
    expect((init.json.result as { instructions: string }).instructions).toContain('planning_guide')
    const guide = toolResult(await http.mcp(secret, 'tools/call', { name: 'planning_guide', arguments: {} }))
    expect(guide.value).toMatchObject({ role: 'pm' })
    expect(String(guide.value.guide)).toContain('Step 5')
    const prompts = (await http.mcp(secret, 'prompts/list')).json.result as { prompts: Array<{ name: string }> }
    expect(prompts.prompts.map((prompt) => prompt.name)).toContain('pm_brd_to_prd')
    const prompt = (await http.mcp(secret, 'prompts/get', { name: 'pm_story_to_tasks', arguments: { workspaceId: 'w-1', storyId: 's-1' } })).json.result as { messages: Array<{ content: { text: string } }> }
    expect(prompt.messages[0].content.text).toContain('planning_guide')
  })

  test('write tools refuse until the current guide is read, and a PRD without the template sections is refused', async () => {
    const owner = await http.signUp('gate-owner')
    const workspaceId = await http.createWorkspace(owner, 'Gate space')
    const pm = await http.signUp('gate-pm')
    await http.inviteAndAccept(owner, workspaceId, pm, 'editor')
    const brd = await http.call('POST', `/api/workspaces/${workspaceId}/planning/documents`, { token: owner.token, body: { kind: 'brd', title: 'BRD', content: 'Needs' } })
    const brdId = (brd.json.data as { document: { id: string } }).document.id
    const { secret } = await issueAndClaim(pm, { role: 'pm' })
    const draft = (content: string) => http.mcp(secret, 'tools/call', { name: 'planning_draft_prd', arguments: { workspaceId, title: 'PRD', content, sourceDocumentId: brdId } })

    expect(toolResult(await draft(PRD_CONTENT))).toMatchObject({ isError: true, value: { code: 'MCP_GUIDE_REQUIRED' } })
    await http.mcp(secret, 'tools/call', { name: 'planning_guide', arguments: {} })
    expect(toolResult(await draft('Just a paragraph.'))).toMatchObject({ isError: true, value: { code: 'MCP_DRAFT_INCOMPLETE' } })
    expect(toolResult(await draft(PRD_CONTENT)).isError).toBe(false)
  })

  test('a member reads the playbook for the role of their key in the portal', async () => {
    const { member } = await memberWithWorkspace('guide-portal')
    expect(((await http.call('GET', '/api/me/mcp-guide', { token: member.token })).json.data as { guide: unknown }).guide).toBeNull()

    await issue(member.user.id, { role: 'qa' })
    const guide = ((await http.call('GET', '/api/me/mcp-guide', { token: member.token })).json.data as { guide: { role: string; guide: string } }).guide
    expect(guide.role).toBe('qa')
    expect(guide.guide).toContain('story_write_test_case')
  })
})
