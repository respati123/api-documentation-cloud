import type { AppContext } from '@/context'
import { ok } from '@/lib/http'
import type { AuthUser } from '@/models/workspace'
import { getBurndown, getSprintReport, getVelocity } from '@/services/reports'

const VELOCITY_SPRINTS = 6
const MAX_VELOCITY_SPRINTS = 24

// Sprint reports, read only, for every member of the project. The services authorize.
export async function handleReportRoutes(ctx: AppContext, url: URL, method: string, workspaceId: string, action: string, user: AuthUser): Promise<Response | undefined> {
  if (method !== 'GET') return undefined
  const sprint = action.match(/^projects\/([\w-]+)\/sprints\/([\w-]+)\/(burndown|report)$/)
  if (sprint) {
    const scope = { workspaceId, projectId: sprint[1] }
    const data = sprint[3] === 'burndown' ? await getBurndown(ctx.db, scope, { userId: user.id }, sprint[2]) : await getSprintReport(ctx.db, scope, { userId: user.id }, sprint[2])
    return ok(data)
  }
  const velocity = action.match(/^projects\/([\w-]+)\/reports\/velocity$/)
  if (velocity) {
    const asked = Number(url.searchParams.get('limit') ?? VELOCITY_SPRINTS)
    const limit = Number.isInteger(asked) && asked >= 1 ? Math.min(asked, MAX_VELOCITY_SPRINTS) : VELOCITY_SPRINTS
    return ok(await getVelocity(ctx.db, { workspaceId, projectId: velocity[1] }, { userId: user.id }, limit))
  }
  return undefined
}
