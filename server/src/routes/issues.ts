import type * as z from 'zod'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { created, noContent, ok } from '@/lib/http'
import { bodyOf } from '@/lib/http-body'
import { decodeCursor, readLimit } from '@/lib/pagination'
import { parseInput } from '@/lib/parse-input'
import {
  checklistAddBody,
  checklistDoneBody,
  createIssueBody,
  draftBacklogBody,
  issueListQuery,
  linkAddBody,
  rankBody,
  updateIssueBody,
} from '@/models/issue-input'
import type { AuthUser } from '@/models/workspace'
import { publishIssue, rankIssue, readBacklog } from '@/services/issue-backlog'
import {
  addChecklistItem,
  addLink,
  deleteChecklistItem,
  listChecklist,
  listLinks,
  removeLink,
  setChecklistItemDone,
} from '@/services/issue-details'
import { draftBacklogFromPrd, markSourceReviewed } from '@/services/issue-import'
import { createIssue, getIssue, listIssuePage, updateIssue } from '@/services/issues'

async function bodyAs<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  return parseInput(schema, await bodyOf(request), 'ISSUE_INPUT_INVALID')
}

// Issues, their checklist and links, and the backlog, all under /projects/:projectId. The services authorize.
export async function handleIssueRoutes(
  ctx: AppContext,
  request: Request,
  url: URL,
  method: string,
  workspaceId: string,
  action: string,
  user: AuthUser,
): Promise<Response | undefined> {
  const draft = action.match(/^projects\/([\w-]+)\/documents\/([\w-]+)\/draft-backlog$/)
  if (draft) {
    if (method !== 'POST') return undefined
    // The outline is optional. Without one, the headings of the PRD give it.
    const body = request.body === null ? {} : await bodyAs(request, draftBacklogBody)
    const issues = await draftBacklogFromPrd(ctx.db, { workspaceId, projectId: draft[1] }, { userId: user.id }, draft[2], 'epics' in body && body.epics ? { epics: body.epics } : undefined)
    return issues.length > 0 ? created({ issues }) : ok({ issues })
  }

  const route = action.match(/^projects\/([\w-]+)\/(backlog|issues(?:\/([\w-]+)(?:\/(rank|publish|source-reviewed|checklist|links)(?:\/([\w-]+))?)?)?)$/)
  if (!route) return undefined
  const { db } = ctx
  const scope = { workspaceId, projectId: route[1] }
  const actor = { userId: user.id }
  const [, , , ref, sub, subId] = route

  if (route[2] === 'backlog') {
    if (method !== 'GET') return undefined
    return ok(await readBacklog(db, scope, actor, { limit: readLimit(url), cursor: decodeCursor(url.searchParams.get('cursor')) }))
  }

  if (!ref) {
    if (method === 'GET') {
      const query = parseInput(issueListQuery, Object.fromEntries([...url.searchParams].filter(([key]) => key !== 'limit' && key !== 'cursor')), 'ISSUE_INPUT_INVALID')
      const sprintId = query.sprint === undefined ? undefined : query.sprint === 'none' ? null : query.sprint
      const page = await listIssuePage(db, scope, actor, { type: query.type, sprintId, parentId: query.epic }, { limit: readLimit(url), cursor: decodeCursor(url.searchParams.get('cursor')) })
      return ok({ issues: page.items }, { nextCursor: page.nextCursor })
    }
    if (method === 'POST') return created({ issue: await createIssue(db, scope, actor, await bodyAs(request, createIssueBody)) })
    return undefined
  }

  if (!sub) {
    if (method === 'GET') return ok({ issue: await getIssue(db, scope, actor, ref) })
    if (method === 'PATCH') return ok({ issue: await updateIssue(db, scope, actor, ref, await bodyAs(request, updateIssueBody)) })
    return undefined
  }

  if (sub === 'rank' && method === 'POST') return ok({ issue: await rankIssue(db, scope, actor, ref, await bodyAs(request, rankBody)) })
  if (sub === 'publish' && method === 'POST') return ok({ issue: await publishIssue(db, scope, actor, ref) })
  if (sub === 'source-reviewed' && method === 'POST') return ok({ issue: await markSourceReviewed(db, scope, actor, ref) })

  if (sub === 'checklist') {
    if (!subId && method === 'GET') return ok({ items: await listChecklist(db, scope, actor, ref) })
    if (!subId && method === 'POST') return created({ item: await addChecklistItem(db, scope, actor, ref, (await bodyAs(request, checklistAddBody)).title) })
    if (subId && method === 'PATCH') return ok({ item: await setChecklistItemDone(db, scope, actor, ref, subId, (await bodyAs(request, checklistDoneBody)).done) })
    if (subId && method === 'DELETE') {
      await deleteChecklistItem(db, scope, actor, ref, subId)
      return noContent()
    }
  }

  if (sub === 'links') {
    if (!subId && method === 'GET') return ok({ links: await listLinks(db, scope, actor, ref) })
    if (!subId && method === 'POST') {
      const body = await bodyAs(request, linkAddBody)
      await addLink(db, scope, actor, ref, body.toId, body.kind)
      return created({ links: await listLinks(db, scope, actor, ref) })
    }
    if (subId && method === 'DELETE') {
      await removeLink(db, scope, actor, ref, subId)
      return noContent()
    }
  }
  // A known path with a method it does not take is a missing route, the same as any other.
  throw new AppError('ROUTE_NOT_FOUND')
}
