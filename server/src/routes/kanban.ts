import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { ok } from '@/lib/http'
import { bodyOf } from '@/lib/http-body'
import type { AuthUser } from '@/models/workspace'
import { getFlowMetrics, listWipLimits, setWipLimit } from '@/services/kanban'

// The Kanban numbers and the limits of the columns, under /projects/:projectId. The services authorize.
export async function handleKanbanRoutes(ctx: AppContext, request: Request, url: URL, method: string, workspaceId: string, action: string, user: AuthUser): Promise<Response | undefined> {
  const flow = action.match(/^projects\/([\w-]+)\/flow$/)
  const limits = action.match(/^projects\/([\w-]+)\/wip-limits(?:\/([\w-]+))?$/)
  const actor = { userId: user.id }
  if (flow && method === 'GET') {
    const asked = url.searchParams.get('days')
    return ok(await getFlowMetrics(ctx.db, { workspaceId, projectId: flow[1] }, actor, { days: asked === null ? undefined : Number(asked) }))
  }
  if (!limits) return undefined
  const scope = { workspaceId, projectId: limits[1] }
  if (!limits[2] && method === 'GET') return ok({ limits: await listWipLimits(ctx.db, scope, actor) })
  if (limits[2] && method === 'PUT') {
    const body = await bodyOf(request)
    const limit = body.limit
    if (Object.keys(body).some((key) => key !== 'limit') || (limit !== null && typeof limit !== 'number')) throw new AppError('PROJECT_INPUT_INVALID')
    return ok({ limits: await setWipLimit(ctx.db, scope, actor, limits[2], limit) })
  }
  return undefined
}
