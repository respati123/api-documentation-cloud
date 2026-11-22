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
  criterionBody,
  criterionMappingBody,
  criterionStrikeBody,
  criterionTestCaseBody,
  createIssueBody,
  draftBacklogBody,
  issueCriteriaBody,
  epicDocumentBody,
  epicDocumentReviseBody,
  issueListQuery,
  linkAddBody,
  rankBody,
  ticketBody,
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
import {
  addCriterionTestCase,
  addEpicCriterion,
  listCriteriaOfIssue,
  listEpicCriteria,
  mapEpicCriterion,
  setIssueCriteria,
  strikeEpicCriterion,
  updateEpicCriterion,
} from '@/services/acceptance-criteria'
import { approveEpicDocument, createEpicDocument, discardEpicDocument, getEpicDocument, listEpicDocuments, reviseEpicDocument } from '@/services/epic-documents'
import { createIssue, getIssue, listIssuePage, updateIssue } from '@/services/issues'
import { getReadiness, getTicket, listEpicTickets, saveTicket } from '@/services/tickets'

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

  // The spec, design and contract of an epic.
  const documents = action.match(/^projects\/([\w-]+)\/issues\/([\w-]+)\/documents(?:\/([\w-]+)(?:\/(approve|discard))?)?$/)
  if (documents) {
    const scope = { workspaceId, projectId: documents[1] }
    const actor = { userId: user.id }
    const [, , epicRef, documentId, step] = documents
    if (!documentId && method === 'GET') return ok(await listEpicDocuments(ctx.db, scope, actor, epicRef))
    if (!documentId && method === 'POST') return created({ document: await createEpicDocument(ctx.db, scope, actor, epicRef, await bodyAs(request, epicDocumentBody)) })
    if (documentId && !step && method === 'GET') return ok({ document: await getEpicDocument(ctx.db, scope, actor, epicRef, documentId) })
    if (documentId && !step && method === 'PATCH') return ok({ document: await reviseEpicDocument(ctx.db, scope, actor, epicRef, documentId, await bodyAs(request, epicDocumentReviseBody)) })
    if (step === 'approve' && method === 'POST') return ok({ document: await approveEpicDocument(ctx.db, scope, actor, epicRef, documentId) })
    if (step === 'discard' && method === 'POST') return ok({ document: await discardEpicDocument(ctx.db, scope, actor, epicRef, documentId) })
    throw new AppError('ROUTE_NOT_FOUND')
  }

  // The acceptance criteria of an epic, by number, and the criteria a task or bug delivers.
  const criteria = action.match(/^projects\/([\w-]+)\/issues\/([\w-]+)\/acceptance-criteria(?:\/(\d+)(?:\/(strike|design-mapping|test-cases))?)?$/)
  if (criteria) {
    const scope = { workspaceId, projectId: criteria[1] }
    const actor = { userId: user.id }
    const [, , ref, numberText, step] = criteria
    const number = numberText === undefined ? undefined : Number(numberText)
    if (number === undefined && method === 'GET') return ok(await listEpicCriteria(ctx.db, scope, actor, ref))
    if (number === undefined && method === 'POST') return created({ criterion: await addEpicCriterion(ctx.db, scope, actor, ref, await bodyAs(request, criterionBody)) })
    if (number !== undefined && !step && method === 'PATCH') return ok({ criterion: await updateEpicCriterion(ctx.db, scope, actor, ref, number, await bodyAs(request, criterionBody)) })
    if (step === 'strike' && method === 'POST') return ok({ criterion: await strikeEpicCriterion(ctx.db, scope, actor, ref, number, (await bodyAs(request, criterionStrikeBody)).reason) })
    if (step === 'design-mapping' && method === 'PUT') return ok({ criterion: await mapEpicCriterion(ctx.db, scope, actor, ref, number, (await bodyAs(request, criterionMappingBody)).entries) })
    if (step === 'test-cases' && method === 'POST') return created({ criterion: await addCriterionTestCase(ctx.db, scope, actor, ref, number, await bodyAs(request, criterionTestCaseBody)) })
    throw new AppError('ROUTE_NOT_FOUND')
  }
  // The ticket fields of a task, and whether it is Ready.
  const ticket = action.match(/^projects\/([\w-]+)\/issues\/([\w-]+)\/(ticket|readiness)$/)
  if (ticket) {
    const scope = { workspaceId, projectId: ticket[1] }
    const actor = { userId: user.id }
    if (ticket[3] === 'ticket' && method === 'GET') return ok({ ticket: await getTicket(ctx.db, scope, actor, ticket[2]) })
    if (ticket[3] === 'ticket' && method === 'PUT') return ok({ ticket: await saveTicket(ctx.db, scope, actor, ticket[2], await bodyAs(request, ticketBody)) })
    if (ticket[3] === 'readiness' && method === 'GET') return ok({ readiness: await getReadiness(ctx.db, scope, actor, ticket[2]) })
    throw new AppError('ROUTE_NOT_FOUND')
  }
  // Every ticket of an epic with its readiness and dependencies, and the load of each member.
  const epicTickets = action.match(/^projects\/([\w-]+)\/issues\/([\w-]+)\/tickets$/)
  if (epicTickets) {
    if (method !== 'GET') throw new AppError('ROUTE_NOT_FOUND')
    return ok(await listEpicTickets(ctx.db, { workspaceId, projectId: epicTickets[1] }, { userId: user.id }, epicTickets[2]))
  }
  const delivered = action.match(/^projects\/([\w-]+)\/issues\/([\w-]+)\/delivers$/)
  if (delivered) {
    const scope = { workspaceId, projectId: delivered[1] }
    const actor = { userId: user.id }
    if (method === 'GET') return ok({ criteria: await listCriteriaOfIssue(ctx.db, scope, actor, delivered[2]) })
    if (method === 'PUT') return ok({ criteria: await setIssueCriteria(ctx.db, scope, actor, delivered[2], (await bodyAs(request, issueCriteriaBody)).numbers) })
    throw new AppError('ROUTE_NOT_FOUND')
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
      const page = await listIssuePage(db, scope, actor, { type: query.type, sprintId, parentId: query.epic, q: query.q }, { limit: readLimit(url), cursor: decodeCursor(url.searchParams.get('cursor')) })
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
