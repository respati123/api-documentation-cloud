import type { AppContext } from '@/context'
import { bodyOf } from '@/lib/http-body'
import { created, noContent, ok } from '@/lib/http'
import { decodeCursor, readLimit } from '@/lib/pagination'
import type { AuthUser } from '@/models/workspace'
import { claimMyMcpKey, getMyMcpGuide, getMyMcpKey, issueMcpKey, listKeyMembersPage, mcpToolMatrix, reissueMcpKey, revokeMcpKeyAsAdmin } from '@/services/mcp-keys'
import { requireAdmin } from '@/services/admin'

function noStore(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function handleMcpKeyRoutes(ctx: AppContext, request: Request, url: URL, method: string, path: string, user: AuthUser): Promise<Response | undefined> {
  const { db } = ctx

  if (method === 'GET' && path === '/api/me/mcp-key') return ok({ key: await getMyMcpKey(db, user.id) })
  if (method === 'GET' && path === '/api/me/mcp-guide') return ok({ guide: await getMyMcpGuide(db, user.id) })

  const claimMatch = path.match(/^\/api\/me\/mcp-key\/([\w-]+)\/claim$/)
  if (method === 'POST' && claimMatch) return noStore(created(await claimMyMcpKey(db, user.id, claimMatch[1])))

  if (method === 'GET' && path === '/api/admin/mcp-tools') {
    await requireAdmin(db, user.id)
    return ok(mcpToolMatrix())
  }

  if (method === 'GET' && path === '/api/admin/mcp-keys') {
    const page = await listKeyMembersPage(db, user.id, url.searchParams.get('q') ?? '', readLimit(url), decodeCursor(url.searchParams.get('cursor')))
    return ok({ members: page.items }, { nextCursor: page.nextCursor })
  }

  if (method === 'POST' && path === '/api/admin/mcp-keys') return created(await issueMcpKey(ctx, user.id, await bodyOf(request)))

  const reissueMatch = path.match(/^\/api\/admin\/mcp-keys\/([\w-]+)\/reissue$/)
  if (method === 'POST' && reissueMatch) return created(await reissueMcpKey(ctx, user.id, reissueMatch[1]))

  const keyMatch = path.match(/^\/api\/admin\/mcp-keys\/([\w-]+)$/)
  if (method === 'DELETE' && keyMatch) {
    await revokeMcpKeyAsAdmin(db, user.id, keyMatch[1])
    return noContent()
  }

  return undefined
}
