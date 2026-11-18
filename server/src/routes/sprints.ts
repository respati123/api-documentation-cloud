import type * as z from 'zod'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { created, noContent, ok } from '@/lib/http'
import { bodyOf } from '@/lib/http-body'
import { parseInput } from '@/lib/parse-input'
import { sprintBody, sprintCloseBody, sprintItemBody, sprintPatchBody } from '@/models/issue-input'
import type { AuthUser } from '@/models/workspace'
import { addSprintItem, closeSprint, createSprint, listSprints, removeSprintItem, startSprint, updateSprint } from '@/services/sprints'

async function bodyAs<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  return parseInput(schema, await bodyOf(request), 'SPRINT_INPUT_INVALID')
}

// Sprints and their items, under /projects/:projectId/sprints. The services authorize.
export async function handleSprintRoutes(
  ctx: AppContext,
  request: Request,
  method: string,
  workspaceId: string,
  action: string,
  user: AuthUser,
): Promise<Response | undefined> {
  const route = action.match(/^projects\/([\w-]+)\/sprints(?:\/([\w-]+)(?:\/(items|start|close)(?:\/([\w-]+))?)?)?$/)
  if (!route) return undefined
  const { db } = ctx
  const scope = { workspaceId, projectId: route[1] }
  const actor = { userId: user.id }
  const [, , sprintId, sub, issueRef] = route

  if (!sprintId) {
    if (method === 'GET') return ok({ sprints: await listSprints(db, scope, actor) })
    if (method === 'POST') return created({ sprint: await createSprint(db, scope, actor, await bodyAs(request, sprintBody)) })
    return undefined
  }
  if (!sub) {
    if (method === 'PATCH') return ok({ sprint: await updateSprint(db, scope, actor, sprintId, await bodyAs(request, sprintPatchBody)) })
    return undefined
  }
  if (sub === 'start' && method === 'POST') return ok({ sprint: await startSprint(db, scope, actor, sprintId) })
  if (sub === 'close' && method === 'POST') return ok({ sprint: await closeSprint(db, scope, actor, sprintId, await bodyAs(request, sprintCloseBody)) })
  if (sub === 'items' && !issueRef && method === 'POST') {
    const body = await bodyAs(request, sprintItemBody)
    await addSprintItem(db, scope, actor, sprintId, body.issueId, { overrideReason: body.overrideReason })
    return created({ sprints: await listSprints(db, scope, actor) })
  }
  if (sub === 'items' && issueRef && method === 'DELETE') {
    await removeSprintItem(db, scope, actor, sprintId, issueRef)
    return noContent()
  }
  throw new AppError('ROUTE_NOT_FOUND')
}
