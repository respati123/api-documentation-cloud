import { AppError } from '@/lib/errors/app-error'
import type { AppName } from '@/repositories/app-links.repository'
import type { OidcKeys, OidcUser } from './oidc-keys'

const TIMEOUT_MS = 10_000

export type AppProject = { id: string; name: string }
export type AppItem = { id: string; name: string }
export type RpcAnswer = { result?: unknown; error?: { code: number; message: string; data?: unknown } }

// Calls DBDesign and Stitchkit for a member. Each request carries a 60-second service token for that member and that app,
// so the app applies the member's own access. An app without an address, or a portal without OIDC keys, is not enabled.
export function createAppsClient(options: { apps: Record<AppName, string | null>; keys: OidcKeys | null; fetchFn?: typeof fetch }) {
  const fetchFn = options.fetchFn ?? fetch

  function baseOf(app: AppName): string {
    const base = options.apps[app]
    if (!base || !options.keys) throw new AppError('APP_NOT_CONFIGURED')
    return base
  }

  async function send(app: AppName, actor: OidcUser, path: string, init: RequestInit = {}): Promise<Response> {
    const base = baseOf(app)
    const token = await (options.keys as OidcKeys).signServiceToken({ user: actor, audience: app })
    let response: Response
    try {
      response = await fetchFn(`${base}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${token}`, ...(init.headers as Record<string, string> | undefined) },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw new AppError('APP_UNAVAILABLE')
    }
    if (response.status === 404) throw new AppError('APP_PROJECT_NOT_FOUND')
    if (response.status === 401 || response.status === 403) throw new AppError('APP_ACCESS_DENIED')
    if (!response.ok) throw new AppError('APP_UNAVAILABLE')
    return response
  }

  async function getJson(app: AppName, actor: OidcUser, path: string): Promise<unknown> {
    const response = await send(app, actor, path)
    try {
      return await response.json()
    } catch {
      throw new AppError('APP_UNAVAILABLE')
    }
  }

  return {
    enabled(app: AppName): boolean {
      return Boolean(options.apps[app] && options.keys)
    },

    // Where the browser opens a project, or a screen inside a Stitchkit project.
    openUrl(app: AppName, projectId: string, screenId?: string): string | null {
      const base = options.apps[app]
      if (!base) return null
      if (app === 'dbdesign') return `${base}/project/${encodeURIComponent(projectId)}`
      return `${base}/p/${encodeURIComponent(projectId)}${screenId ? `?screen=${encodeURIComponent(screenId)}` : ''}`
    },

    // Projects the member can open in the app. DBDesign answers { projects }, Stitchkit a plain list.
    async listProjects(app: AppName, actor: OidcUser): Promise<AppProject[]> {
      const body = await getJson(app, actor, '/api/projects')
      const list = Array.isArray(body) ? body : (body as { projects?: unknown }).projects
      if (!Array.isArray(list)) throw new AppError('APP_UNAVAILABLE')
      return list.map((item: { id: unknown; name: unknown }) => ({ id: String(item.id), name: String(item.name) }))
    },

    // The screens of a Stitchkit project. Components are left out.
    async stitchkitScreens(actor: OidcUser, projectId: string): Promise<AppItem[]> {
      const body = (await getJson('stitchkit', actor, `/api/projects/${encodeURIComponent(projectId)}`)) as { screens?: Array<{ screen: { id: string; name: string; kind?: string } }> }
      return (body.screens ?? []).filter((entry) => (entry.screen.kind ?? 'screen') === 'screen').map((entry) => ({ id: entry.screen.id, name: entry.screen.name }))
    },

    // The tables of a DBDesign project, with the project name the app knows.
    async dbdesignTables(actor: OidcUser, projectId: string): Promise<{ projectName: string | undefined; tables: AppItem[] }> {
      const body = (await getJson('dbdesign', actor, `/api/projects/${encodeURIComponent(projectId)}`)) as {
        project?: { name?: string; diagram_json?: { tables?: Array<{ id: string; name: string }> } }
      }
      const tables = body.project?.diagram_json?.tables ?? []
      return { projectName: body.project?.name, tables: tables.map((table) => ({ id: table.id, name: table.name })) }
    },

    // One JSON-RPC call to the app's MCP endpoint. The app may answer with JSON or with server-sent events.
    async mcp(app: AppName, actor: OidcUser, method: string, params: unknown): Promise<RpcAnswer> {
      const response = await send(app, actor, '/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      const text = await response.text()
      const json = (response.headers.get('content-type') ?? '').includes('text/event-stream')
        ? text.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).pop()
        : text
      try {
        const answer = JSON.parse(json ?? '') as RpcAnswer
        return answer.error ? { error: answer.error } : { result: answer.result }
      } catch {
        throw new AppError('APP_UNAVAILABLE')
      }
    },
  }
}

export type AppsClient = ReturnType<typeof createAppsClient>
