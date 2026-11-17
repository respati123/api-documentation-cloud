import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { decodeJwt, exportPKCS8, generateKeyPair } from 'jose'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'
import { resetAppToolCacheForTests } from '@/routes/mcp'

type Seen = { audience?: unknown; failToolsList?: boolean; calls: Array<{ name: string; args: Record<string, unknown> }> }

// A fake DBDesign or Stitchkit: project lists, one project detail, and an MCP endpoint that echoes tool calls.
function fakeApp(kind: 'dbdesign' | 'stitchkit') {
  const seen: Seen = { calls: [] }
  const tools =
    kind === 'dbdesign'
      ? [{ name: 'dbdesign_project_get', inputSchema: { properties: { projectId: { type: 'string' } }, required: ['projectId'] } }, { name: 'dbdesign_project_create', inputSchema: { properties: {} } }]
      : [{ name: 'get_project', annotations: { readOnlyHint: true }, inputSchema: { properties: { projectId: { type: 'string' } }, required: ['projectId'] } }, { name: 'create_screen', inputSchema: { properties: { projectId: { type: 'string' } }, required: ['projectId'] } }, { name: 'create_project', inputSchema: { properties: {} } }]
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
      seen.audience = token ? decodeJwt(token).aud : undefined
      const url = new URL(request.url)
      if (url.pathname === '/api/projects') {
        return kind === 'dbdesign' ? Response.json({ projects: [{ id: 'd1', name: 'Toko' }, { id: 'd2', name: 'Gudang' }] }) : Response.json([{ id: 's1', name: 'Kopi' }])
      }
      if (url.pathname === '/api/projects/d1') return Response.json({ project: { id: 'd1', name: 'Toko', diagram_json: { tables: [{ id: 't1', name: 'orders' }] } } })
      if (url.pathname === '/api/projects/s1') return Response.json({ screens: [{ screen: { id: 'sc1', name: 'Masuk', kind: 'screen' } }] })
      if (url.pathname === '/mcp') {
        const body = (await request.json()) as { id: number; method: string; params: { name: string; arguments: Record<string, unknown> } }
        if (body.method === 'tools/list' && seen.failToolsList) return Response.json({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: 'down' } })
        if (body.method === 'tools/list') return Response.json({ jsonrpc: '2.0', id: body.id, result: { tools } })
        seen.calls.push({ name: body.params.name, args: body.params.arguments })
        return Response.json({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: JSON.stringify({ called: body.params.name }) }] } })
      }
      return new Response('not found', { status: 404 })
    },
  })
  return { server, seen, base: `http://127.0.0.1:${server.port}` }
}

describe.skipIf(!databaseEnabled)('DBDesign and Stitchkit integration', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>
  const dbdesign = fakeApp('dbdesign')
  const stitchkit = fakeApp('stitchkit')
  const saved: Record<string, string | undefined> = {}

  beforeAll(async () => {
    db = await openTestDatabase()
    const { privateKey } = await generateKeyPair('ES256', { extractable: true })
    const env = {
      OIDC_SIGNING_KEY_B64: Buffer.from(await exportPKCS8(privateKey)).toString('base64'),
      OIDC_SIGNING_KEY_ID: 'apps-test',
      DBDESIGN_URL: dbdesign.base,
      STITCHKIT_URL: stitchkit.base,
    }
    for (const [key, value] of Object.entries(env)) {
      saved[key] = process.env[key]
      process.env[key] = value
    }
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  afterAll(async () => {
    dbdesign.server.stop(true)
    stitchkit.server.stop(true)
    await db.close()
  })

  async function team(label: string, roles: string[]) {
    const owner = await http.signUp(`${label}-owner`)
    const made = await http.call('POST', '/api/workspaces', { token: owner.token, body: { name: `${label} space`, tree: [], variables: { globals: [], environments: [] } } })
    const workspaceId = (made.json.data as { workspace: { id: string } }).workspace.id
    const member = await http.signUp(label)
    await http.inviteAndAccept(owner, workspaceId, member, 'editor')
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
    const projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
    await http.call('POST', `/api/workspaces/${workspaceId}/projects/${projectId}/members`, { token: owner.token, body: { userId: member.user.id, disciplines: roles } })
    return { owner, member, workspaceId }
  }

  async function link(owner: TestAccount, workspaceId: string, app: string, appProjectId: string) {
    return http.call('POST', `/api/workspaces/${workspaceId}/apps/${app}/links`, { token: owner.token, body: { appProjectId } })
  }

  test('members see both apps and their links, and only the owner may manage them', async () => {
    const { owner, member, workspaceId } = await team('apps-list', [])
    const forMember = await http.call('GET', `/api/workspaces/${workspaceId}/apps`, { token: member.token })
    expect(forMember.status).toBe(200)
    const data = forMember.json.data as { canManage: boolean; apps: Array<{ app: string; enabled: boolean; links: unknown[] }> }
    expect(data.canManage).toBe(false)
    expect(data.apps.map((item) => [item.app, item.enabled])).toEqual([['dbdesign', true], ['stitchkit', true]])

    expect((await http.call('GET', `/api/workspaces/${workspaceId}/apps/dbdesign/available`, { token: member.token })).status).toBe(403)
    expect((await link(member, workspaceId, 'dbdesign', 'd1')).status).toBe(403)

    const available = await http.call('GET', `/api/workspaces/${workspaceId}/apps/dbdesign/available`, { token: owner.token })
    expect((available.json.data as { projects: unknown[] }).projects).toEqual([{ id: 'd1', name: 'Toko' }, { id: 'd2', name: 'Gudang' }])
    expect(dbdesign.seen.audience).toBe('dbdesign')
  })

  test('the owner links a project once, an unknown project is refused, and the link can be removed', async () => {
    const { owner, workspaceId } = await team('apps-link', [])
    const linked = await link(owner, workspaceId, 'dbdesign', 'd1')
    expect(linked.status).toBe(201)
    const linkId = (linked.json.data as { link: { id: string; url: string } }).link.id
    expect((linked.json.data as { link: { url: string } }).link.url).toBe(`${dbdesign.base}/project/d1`)
    expect((await link(owner, workspaceId, 'dbdesign', 'd1')).status).toBe(409)
    expect((await link(owner, workspaceId, 'dbdesign', 'nope')).json.code).toBe('APP_PROJECT_NOT_FOUND')
    expect((await link(owner, workspaceId, 'figma', 'x')).json.code).toBe('APP_NAME_INVALID')

    const listed = await http.call('GET', `/api/workspaces/${workspaceId}/apps`, { token: owner.token })
    const apps = (listed.json.data as { apps: Array<{ app: string; links: Array<{ projectId: string }> }> }).apps
    expect(apps.find((item) => item.app === 'dbdesign')?.links.map((item) => item.projectId)).toEqual(['d1'])
    expect((await http.call('GET', `/api/workspaces/${workspaceId}/apps/dbdesign/available`, { token: owner.token })).json.data).toEqual({ projects: [{ id: 'd2', name: 'Gudang' }] })

    expect((await http.call('DELETE', `/api/workspaces/${workspaceId}/apps/links/${linkId}`, { token: owner.token })).status).toBe(204)
    expect((await http.call('DELETE', `/api/workspaces/${workspaceId}/apps/links/${linkId}`, { token: owner.token })).json.code).toBe('APP_LINK_NOT_FOUND')
  })

  test('the pickers list screens and tables of the linked projects only', async () => {
    const { owner, member, workspaceId } = await team('apps-pickers', ['backend'])
    await link(owner, workspaceId, 'stitchkit', 's1')
    await link(owner, workspaceId, 'dbdesign', 'd1')
    const screens = await http.call('GET', `/api/workspaces/${workspaceId}/apps/stitchkit/screens`, { token: member.token })
    expect(screens.json.data).toEqual({
      projects: [{ projectId: 's1', projectName: 'Kopi', items: [{ id: 'sc1', name: 'Masuk', url: `${stitchkit.base}/p/s1?screen=sc1` }], error: null }],
    })
    const tables = await http.call('GET', `/api/workspaces/${workspaceId}/apps/dbdesign/tables`, { token: member.token })
    expect(tables.json.data).toEqual({ projects: [{ projectId: 'd1', projectName: 'Toko', items: [{ id: 't1', name: 'orders' }], error: null }] })
  })

  test('an app that cannot list its tools is left out, and its tools return on the next list', async () => {
    const { owner, workspaceId } = await team('apps-tools-down', ['backend'])
    await link(owner, workspaceId, 'dbdesign', 'd1')
    const secret = ((await http.call('POST', '/api/me/mcp-keys', { token: owner.token, body: { name: 'Laptop', validDays: 30 } })).json.data as { secret: string }).secret
    const names = async () => (((await http.mcp(secret, 'tools/list')).json.result as { tools: Array<{ name: string }> }).tools).map((item) => item.name)

    resetAppToolCacheForTests()
    dbdesign.seen.failToolsList = true
    expect((await names()).some((name) => name.startsWith('dbdesign_'))).toBe(false)

    dbdesign.seen.failToolsList = false
    expect(await names()).toContain('dbdesign_project_get')
    resetAppToolCacheForTests()
  })

  test('DBDesign is closed to disciplines outside backend, tech lead, and PM', async () => {
    const { owner, member, workspaceId } = await team('apps-frontend', ['frontend'])
    await link(owner, workspaceId, 'dbdesign', 'd1')
    const tables = await http.call('GET', `/api/workspaces/${workspaceId}/apps/dbdesign/tables`, { token: member.token })
    expect(tables.status).toBe(403)
    const listed = await http.call('GET', `/api/workspaces/${workspaceId}/apps`, { token: member.token })
    const apps = (listed.json.data as { apps: Array<{ app: string; canUse: boolean }> }).apps
    expect(apps.find((item) => item.app === 'dbdesign')?.canUse).toBe(false)
    expect(apps.find((item) => item.app === 'stitchkit')?.canUse).toBe(true)
  })

  test('a story data model takes tables from linked projects only, shows on the story, and can be removed', async () => {
    const { owner, workspaceId } = await team('apps-story', [])
    await link(owner, workspaceId, 'dbdesign', 'd1')
    const epicId = randomUUID()
    const storyId = randomUUID()
    await db`INSERT INTO planning_items (id, workspace_id, kind, title, created_by) VALUES (${epicId}, ${workspaceId}, 'epic', 'Belanja', ${owner.user.id})`
    await db`INSERT INTO planning_items (id, workspace_id, kind, parent_id, title, created_by) VALUES (${storyId}, ${workspaceId}, 'story', ${epicId}, 'Checkout', ${owner.user.id})`
    const path = `/api/workspaces/${workspaceId}/planning/stories/${storyId}`

    const added = await http.call('POST', `${path}/data-models`, { token: owner.token, body: { projectId: 'd1', tableId: 't1' } })
    expect(added.status).toBe(201)
    expect((await http.call('POST', `${path}/data-models`, { token: owner.token, body: { projectId: 'd1', tableId: 't1' } })).status).toBe(409)
    expect((await http.call('POST', `${path}/data-models`, { token: owner.token, body: { projectId: 'd2', tableId: 't1' } })).json.code).toBe('APP_PROJECT_NOT_LINKED')
    expect((await http.call('POST', `${path}/data-models`, { token: owner.token, body: { projectId: 'd1', tableId: 'nope' } })).json.code).toBe('APP_TABLE_NOT_FOUND')

    const story = await http.call('GET', path, { token: owner.token })
    const models = (story.json.data as { story: { dataModels: Array<{ id: string; tableName: string; projectName: string }> } }).story.dataModels
    expect(models.map((model) => [model.projectName, model.tableName])).toEqual([['Toko', 'orders']])

    expect((await http.call('DELETE', `${path}/data-models/${models[0].id}`, { token: owner.token })).status).toBe(204)
    expect((await http.call('DELETE', `${path}/data-models/${models[0].id}`, { token: owner.token })).json.code).toBe('DATA_MODEL_NOT_FOUND')
  })

  test('the portal MCP offers app tools by project role, hides lifecycle tools, and forwards calls for linked projects only', async () => {
    const { owner, member, workspaceId } = await team('apps-mcp', ['backend'])
    await link(owner, workspaceId, 'dbdesign', 'd1')
    const created = await http.call('POST', '/api/me/mcp-keys', { token: member.token, body: { name: 'Laptop', validDays: 30 } })
    const secret = (created.json.data as { secret: string }).secret

    const listed = await http.mcp(secret, 'tools/list')
    const names = ((listed.json.result as { tools: Array<{ name: string }> }).tools).map((item) => item.name)
    expect(names).toContain('dbdesign_project_get')
    expect(names).toContain('story_link_data_model')
    expect(names).not.toContain('dbdesign_project_create')
    expect(names).not.toContain('stitchkit_create_screen')

    const call = (name: string, args: Record<string, unknown>) => http.mcp(secret, 'tools/call', { name, arguments: args })
    const ok = await call('dbdesign_project_get', { workspaceId, projectId: 'd1' })
    expect(JSON.parse((ok.json.result as { content: Array<{ text: string }> }).content[0].text)).toEqual({ called: 'dbdesign_project_get' })
    expect(dbdesign.seen.calls.at(-1)).toEqual({ name: 'dbdesign_project_get', args: { projectId: 'd1' } })

    const notLinked = await call('dbdesign_project_get', { workspaceId, projectId: 'd2' })
    expect(JSON.parse((notLinked.json.result as { content: Array<{ text: string }> }).content[0].text).code).toBe('APP_PROJECT_NOT_LINKED')
    const noRole = await call('stitchkit_create_screen', { workspaceId, projectId: 's1' })
    expect(JSON.parse((noRole.json.result as { content: Array<{ text: string }> }).content[0].text).code).toBe('MCP_PERMISSION_DENIED')
    const blocked = await call('dbdesign_project_create', { workspaceId })
    expect(JSON.parse((blocked.json.result as { content: Array<{ text: string }> }).content[0].text).code).toBe('MCP_PERMISSION_DENIED')
  })

  test('Stitchkit: every member reads through MCP, only UI/UX changes', async () => {
    const { owner, member, workspaceId } = await team('apps-stitch-read', ['backend'])
    await link(owner, workspaceId, 'stitchkit', 's1')
    const secret = ((await http.call('POST', '/api/me/mcp-keys', { token: member.token, body: { name: 'Laptop', validDays: 30 } })).json.data as { secret: string }).secret
    const names = (((await http.mcp(secret, 'tools/list')).json.result as { tools: Array<{ name: string }> }).tools).map((item) => item.name)
    expect(names).toContain('stitchkit_get_project')
    expect(names).not.toContain('stitchkit_create_screen')
    const read = await http.mcp(secret, 'tools/call', { name: 'stitchkit_get_project', arguments: { workspaceId, projectId: 's1' } })
    expect(JSON.parse((read.json.result as { content: Array<{ text: string }> }).content[0].text)).toEqual({ called: 'get_project' })
    const write = await http.mcp(secret, 'tools/call', { name: 'stitchkit_create_screen', arguments: { workspaceId, projectId: 's1' } })
    expect(JSON.parse((write.json.result as { content: Array<{ text: string }> }).content[0].text).code).toBe('MCP_PERMISSION_DENIED')
  })

  test('Stitchkit: a UI/UX member may change screens through MCP', async () => {
    const { owner, member, workspaceId } = await team('apps-stitch-write', ['ui_ux'])
    await link(owner, workspaceId, 'stitchkit', 's1')
    const secret = ((await http.call('POST', '/api/me/mcp-keys', { token: member.token, body: { name: 'Laptop', validDays: 30 } })).json.data as { secret: string }).secret
    const write = await http.mcp(secret, 'tools/call', { name: 'stitchkit_create_screen', arguments: { workspaceId, projectId: 's1' } })
    expect(JSON.parse((write.json.result as { content: Array<{ text: string }> }).content[0].text)).toEqual({ called: 'create_screen' })
  })
})
