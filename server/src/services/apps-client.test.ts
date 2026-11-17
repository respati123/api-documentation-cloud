import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { exportPKCS8, generateKeyPair, importJWK, jwtVerify } from 'jose'
import { createOidcKeys } from './oidc-keys'
import { createAppsClient } from './apps-client'

const issuer = 'https://docs.example.test/api/oidc'
const actor = { id: 'user-1', email: 'ana@example.test', isAdmin: false }

// A fake app: project lists in both app shapes, one project detail each, and an MCP endpoint that answers over SSE.
function startFakeApp() {
  const seen: { authorization?: string } = {}
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      seen.authorization = request.headers.get('authorization') ?? undefined
      if (url.pathname === '/api/projects' && url.searchParams.get('shape') === 'dbdesign') return Response.json({ projects: [{ id: 'd1', name: 'Toko' }] })
      if (url.pathname === '/api/projects') return Response.json([{ id: 's1', name: 'Aplikasi kopi' }])
      if (url.pathname === '/api/projects/s1') return Response.json({ project: { id: 's1' }, screens: [{ screen: { id: 'sc1', name: 'Masuk', kind: 'screen' } }, { screen: { id: 'c1', name: 'Tombol', kind: 'component' } }] })
      if (url.pathname === '/api/projects/d1') return Response.json({ project: { id: 'd1', diagram_json: { tables: [{ id: 't1', name: 'orders' }] } } })
      if (url.pathname === '/api/projects/missing') return Response.json({ error: 'nope' }, { status: 404 })
      if (url.pathname === '/mcp') {
        const body = (await request.json()) as { id: number; method: string }
        const payload = JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { method: body.method } })
        return new Response(`event: message\ndata: ${payload}\n\n`, { headers: { 'content-type': 'text/event-stream' } })
      }
      return new Response('not found', { status: 404 })
    },
  })
  return { server, seen, base: `http://127.0.0.1:${server.port}` }
}

describe('apps client', () => {
  let fake: ReturnType<typeof startFakeApp>
  let keys: ReturnType<typeof createOidcKeys>

  beforeAll(async () => {
    fake = startFakeApp()
    const { privateKey } = await generateKeyPair('ES256', { extractable: true })
    keys = createOidcKeys({ signingKeyPem: await exportPKCS8(privateKey), keyId: 'k1', issuer })
  })

  afterAll(() => {
    fake.server.stop(true)
  })

  test('an app without an address or without OIDC keys is not enabled', () => {
    expect(createAppsClient({ apps: { dbdesign: null, stitchkit: null }, keys }).enabled('dbdesign')).toBe(false)
    expect(createAppsClient({ apps: { dbdesign: fake.base, stitchkit: null }, keys: null }).enabled('dbdesign')).toBe(false)
    expect(createAppsClient({ apps: { dbdesign: fake.base, stitchkit: null }, keys }).enabled('dbdesign')).toBe(true)
  })

  test('calls the app with a service token for the member and this app', async () => {
    const client = createAppsClient({ apps: { dbdesign: null, stitchkit: fake.base }, keys })
    expect(await client.listProjects('stitchkit', actor)).toEqual([{ id: 's1', name: 'Aplikasi kopi' }])
    const token = (fake.seen.authorization ?? '').replace('Bearer ', '')
    const key = await importJWK((await keys.publicJwks()).keys[0]!, 'ES256')
    const { payload } = await jwtVerify(token, key, { issuer, audience: 'stitchkit' })
    expect(payload).toMatchObject({ sub: 'user-1', token_use: 'service' })
  })

  test('reads screens, skipping components, and DBDesign tables', async () => {
    const client = createAppsClient({ apps: { dbdesign: fake.base, stitchkit: fake.base }, keys })
    expect(await client.stitchkitScreens(actor, 's1')).toEqual([{ id: 'sc1', name: 'Masuk' }])
    expect(await client.dbdesignTables(actor, 'd1')).toEqual({ projectName: undefined, tables: [{ id: 't1', name: 'orders' }] })
  })

  test('a missing project and an unreachable app become portal errors', async () => {
    const client = createAppsClient({ apps: { dbdesign: fake.base, stitchkit: 'http://127.0.0.1:9' }, keys })
    await expect(client.dbdesignTables(actor, 'missing')).rejects.toMatchObject({ code: 'APP_PROJECT_NOT_FOUND' })
    await expect(client.listProjects('stitchkit', actor)).rejects.toMatchObject({ code: 'APP_UNAVAILABLE' })
    await expect(createAppsClient({ apps: { dbdesign: null, stitchkit: null }, keys }).listProjects('dbdesign', actor)).rejects.toMatchObject({ code: 'APP_NOT_CONFIGURED' })
  })

  test('an MCP call reads a JSON-RPC answer sent as server-sent events', async () => {
    const client = createAppsClient({ apps: { dbdesign: null, stitchkit: fake.base }, keys })
    expect(await client.mcp('stitchkit', actor, 'tools/list', {})).toEqual({ result: { method: 'tools/list' } })
  })
})
