import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import type { IssueRow } from '@/models/issue'
import { EMPTY_DETAILS, isTicketRole, mergeDetails, READINESS_ITEMS, type ReadinessItem, readinessMisses, ROLE_CODES, SIZE_POINTS, type TicketDetails } from '@/models/ticket'
import { listIssueCriteria, lockEpic } from '@/repositories/acceptance-criteria.repository'
import { blocksReach, findIssue, insertLinkRow, updateIssueFields } from '@/repositories/issues.repository'
import { listEpicDocumentRows } from '@/repositories/planning-documents.repository'
import { deleteBlockersOf, findTicketDetails, listBlockerIds, nextTicketSeq, saveTicketDetails } from '@/repositories/ticket-details.repository'
import { type Actor, invalid, type IssueScope, loadVisible, logEvent } from '@/services/issues'
import { resolveProjectRoles } from '@/services/project-roles'

export interface Readiness {
  ready: boolean
  failing: Array<{ item: ReadinessItem; rule: string; reason: string }>
}

export interface Ticket {
  issue: IssueRow
  details: TicketDetails
  readiness: Readiness
}

// The facts the Definition of Ready reads, gathered for one task. A task outside an epic has no spec, design or criteria.
export async function readinessOf(db: SQL, issue: IssueRow): Promise<Readiness> {
  const stored = await findTicketDetails(db, issue.id)
  const details: TicketDetails = stored ?? EMPTY_DETAILS
  const epic = issue.parentId ? await findIssue(db, issue.projectId, issue.parentId) : undefined
  const documents = epic?.type === 'epic' ? await listEpicDocumentRows(db, epic.id) : []
  const documentOf = (kind: string) => documents.find((row) => row.kind === kind)
  const criteria = await listIssueCriteria(db, issue.id)
  const misses = readinessMisses({
    role: issue.role,
    details,
    linkedCriteria: criteria.length,
    struckCriteria: criteria.filter((row) => row.status === 'struck').length,
    specApproved: documentOf('spec')?.status === 'approved',
    designApproved: documentOf('design')?.status === 'approved',
    designStale: documentOf('design')?.stale ?? false,
    contractApproved: documentOf('contract')?.status === 'approved',
    hasDependencyCycle: await blocksReach(db, issue.id, issue.id),
  })
  return { ready: misses.length === 0, failing: misses.map((miss) => ({ ...miss, rule: READINESS_ITEMS[miss.item] })) }
}

async function ticketOf(db: SQL, issue: IssueRow): Promise<Ticket> {
  const fresh = (await findIssue(db, issue.projectId, issue.id)) as IssueRow
  const stored = await findTicketDetails(db, issue.id)
  return { issue: fresh, details: stored ?? EMPTY_DETAILS, readiness: await readinessOf(db, fresh) }
}

export async function getTicket(db: SQL, scope: IssueScope, actor: Actor, ref: string): Promise<Ticket> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const issue = await loadVisible(db, scope, actor, roles, ref)
  if (issue.type !== 'task') throw invalid()
  return ticketOf(db, issue)
}

// The tech lead writes the ticket. An agent key drafts it for its owner. A draft may be partial: the readiness says
// what is still missing. The role gives the ticket its code, and the size fills the points.
export async function saveTicket(db: SQL, scope: IssueScope, actor: Actor, ref: string, input: Record<string, unknown>): Promise<Ticket> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const issue = await loadVisible(db, scope, actor, roles, ref)
  if (!roles.isTechLead) throw new AppError('ROLE_NOT_ALLOWED')
  if (issue.type !== 'task' || !issue.parentId) throw invalid()
  const epic = await findIssue(db, scope.projectId, issue.parentId)
  if (epic?.type !== 'epic') throw invalid()
  const { role, ...fields } = input
  if (role !== undefined && !isTicketRole(role)) throw invalid()

  await db.begin(async (tx) => {
    await lockEpic(tx, epic.id)
    const stored = await findTicketDetails(tx, issue.id)
    const details = mergeDetails(stored ?? EMPTY_DETAILS, fields)
    if (!details) throw invalid()
    const nextRole = role === undefined ? issue.role : role
    const roleCode = nextRole && isTicketRole(nextRole) ? ROLE_CODES[nextRole] : null
    // A new role, or the first one, takes the next number for that role in the epic.
    const keepCode = stored?.roleCode === roleCode && stored?.epicId === epic.id
    const ticketSeq = roleCode === null ? null : keepCode ? stored?.ticketSeq ?? null : await nextTicketSeq(tx, epic.id, roleCode)
    await saveTicketDetails(tx, { ...details, issueId: issue.id, epicId: epic.id, roleCode, ticketSeq })
    await updateIssueFields(tx, scope.projectId, issue.id, { role: nextRole, points: details.size ? SIZE_POINTS[details.size] : null })
    await logEvent(tx, scope, actor, issue.id, 'issue.ticket_saved', { fields: Object.keys(input) })
  })
  return ticketOf(db, issue)
}

export async function getReadiness(db: SQL, scope: IssueScope, actor: Actor, ref: string): Promise<Readiness> {
  return (await getTicket(db, scope, actor, ref)).readiness
}

// What a ticket depends on: the work that must finish first, as blocks links into it. The tech lead sets them, and an
// agent key does so for its tech lead owner while drafting the split. A link that would close a loop is refused.
export async function setTicketDependencies(db: SQL, scope: IssueScope, actor: Actor, ref: string, blockerRefs: unknown): Promise<string[]> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const issue = await loadVisible(db, scope, actor, roles, ref)
  if (!roles.isTechLead) throw new AppError('ROLE_NOT_ALLOWED')
  if (issue.type !== 'task') throw invalid()
  if (!Array.isArray(blockerRefs) || blockerRefs.length > 30 || !blockerRefs.every((value) => typeof value === 'string' && value.length > 0 && value.length <= 100)) throw invalid()
  const blockers: IssueRow[] = []
  for (const blockerRef of new Set(blockerRefs as string[])) {
    const blocker = await loadVisible(db, scope, actor, roles, blockerRef)
    if (blocker.id === issue.id || blocker.type === 'epic' || blocker.type === 'subtask') throw invalid()
    blockers.push(blocker)
  }
  await db.begin(async (tx) => {
    await deleteBlockersOf(tx, issue.id)
    for (const blocker of blockers) {
      if (await blocksReach(tx, issue.id, blocker.id)) throw new AppError('ISSUE_INPUT_INVALID', { details: { cycle: blocker.key } })
      await insertLinkRow(tx, { id: randomUUID(), fromId: blocker.id, toId: issue.id, kind: 'blocks', createdBy: actor.userId })
    }
    await logEvent(tx, scope, actor, issue.id, 'issue.dependencies_set', { dependsOn: blockers.map((blocker) => blocker.key) })
  })
  return listBlockerIds(db, issue.id)
}
