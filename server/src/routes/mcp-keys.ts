import type { AppContext } from '@/context'
import { bodyOf } from '@/lib/http-body'
import { created, noContent, ok } from '@/lib/http'
import { decodeCursor, readLimit } from '@/lib/pagination'
import type { AuthUser } from '@/models/workspace'
import { createMyMcpKey, getMyMcpAccess, getMyMcpGuide, listAllMcpKeysPage, listMyMcpKeys, mcpToolMatrix, revokeMcpKeyAsAdmin, revokeMyMcpKey } from '@/services/mcp-keys'
import { requireAdmin } from '@/services/admin'

function noStore(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function handleMcpKeyRoutes(ctx: AppContext, request: Request, url: URL, method: string, path: string, user: AuthUser): Promise<Response | undefined> {
  const { db } = ctx

  if (method === 'GET' && path === '/api/me/mcp-keys') return ok(await listMyMcpKeys(db, user.id))
  if (method === 'POST' && path === '/api/me/mcp-keys') return noStore(created(await createMyMcpKey(db, user.id, await bodyOf(request))))
  if (method === 'GET' && path === '/api/me/mcp-access') return ok({ workspaces: await getMyMcpAccess(db, user.id) })
  if (method === 'GET' && path === '/api/me/mcp-guide') return ok({ guide: await getMyMcpGuide(db, user.id) })

  const myKeyMatch = path.match(/^\/api\/me\/mcp-keys\/([\w-]+)$/)
  if (method === 'DELETE' && myKeyMatch) {
    await revokeMyMcpKey(db, user.id, myKeyMatch[1])
    return noContent()
  }

  if (method === 'GET' && path === '/api/admin/mcp-tools') {
    await requireAdmin(db, user.id)
    return ok(mcpToolMatrix())
  }

  if (method === 'GET' && path === '/api/admin/mcp-keys') {
    const page = await listAllMcpKeysPage(db, user.id, url.searchParams.get('q') ?? '', readLimit(url), decodeCursor(url.searchParams.get('cursor')))
    return ok({ keys: page.items }, { nextCursor: page.nextCursor })
  }

  const keyMatch = path.match(/^\/api\/admin\/mcp-keys\/([\w-]+)$/)
  if (method === 'DELETE' && keyMatch) {
    await revokeMcpKeyAsAdmin(db, user.id, keyMatch[1])
    return noContent()
  }

  return undefined
}
