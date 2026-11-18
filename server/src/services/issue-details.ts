import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import type { IssueRow } from '@/models/issue'
import {
  blocksReach,
  type ChecklistRow,
  deleteChecklistRow,
  deleteLinkRow,
  findChecklistRow,
  findLinkRow,
  insertChecklistRow,
  insertLinkRow,
  type LinkRow,
  listChecklistRows,
  listLinkRows,
  setChecklistRowDone,
} from '@/repositories/issues.repository'
import { type Actor, invalid, isAgent, type IssueScope, loadVisible, logEvent } from '@/services/issues'
import { type ProjectRoles, resolveProjectRoles } from '@/services/project-roles'

export const LINK_KINDS = ['blocks', 'relates', 'found_in'] as const
export type LinkKind = (typeof LINK_KINDS)[number]

export type IssueLink = Omit<LinkRow, 'issuePublishedAt' | 'issueCreatedBy'>

// Who works on an issue: the PM and the tech lead, its assignee, a member whose role matches a sub-task,
// and the person who filed a bug. A viewer never does.
function mayWork(issue: IssueRow, roles: ProjectRoles, actor: Actor): boolean {
  if (roles.workspaceRole === 'viewer') return false
  const matching = issue.type === 'subtask' && issue.role !== null && roles.disciplines.includes(issue.role)
  return roles.isApprover || issue.assigneeId === actor.userId || matching || (issue.type === 'bug' && issue.createdBy === actor.userId)
}

async function loadForWork(db: SQL, scope: IssueScope, actor: Actor, ref: string, agentMayWork: boolean) {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const issue = await loadVisible(db, scope, actor, roles, ref)
  if (isAgent(actor) && !(agentMayWork && issue.assigneeId === actor.userId)) throw new AppError('ISSUE_AGENT_FORBIDDEN')
  if (!mayWork(issue, roles, actor)) throw new AppError('ROLE_NOT_ALLOWED')
  return issue
}

export async function listChecklist(db: SQL, scope: IssueScope, actor: Actor, ref: string): Promise<ChecklistRow[]> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  return listChecklistRows(db, (await loadVisible(db, scope, actor, roles, ref)).id)
}

// An AI agent key works on the checklist of an issue assigned to its owner.
export async function addChecklistItem(db: SQL, scope: IssueScope, actor: Actor, ref: string, title: string): Promise<ChecklistRow> {
  const issue = await loadForWork(db, scope, actor, ref, true)
  const trimmed = typeof title === 'string' ? title.trim() : ''
  if (trimmed.length < 1 || trimmed.length > 300) throw invalid()
  const row = await insertChecklistRow(db, { id: randomUUID(), issueId: issue.id, title: trimmed })
  await logEvent(db, scope, actor, issue.id, 'issue.checklist_added', {})
  return row
}

export async function setChecklistItemDone(db: SQL, scope: IssueScope, actor: Actor, ref: string, itemId: string, done: boolean): Promise<ChecklistRow> {
  const issue = await loadForWork(db, scope, actor, ref, true)
  const item = await findChecklistRow(db, issue.id, itemId)
  if (!item) throw new AppError('ISSUE_NOT_FOUND')
  await setChecklistRowDone(db, item.id, done)
  return { ...item, done }
}

export async function deleteChecklistItem(db: SQL, scope: IssueScope, actor: Actor, ref: string, itemId: string): Promise<void> {
  const issue = await loadForWork(db, scope, actor, ref, true)
  const item = await findChecklistRow(db, issue.id, itemId)
  if (!item) throw new AppError('ISSUE_NOT_FOUND')
  await deleteChecklistRow(db, item.id)
}

// A member does not see a link to a draft they may not read.
export async function listLinks(db: SQL, scope: IssueScope, actor: Actor, ref: string): Promise<IssueLink[]> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const issue = await loadVisible(db, scope, actor, roles, ref)
  const rows = await listLinkRows(db, issue.id)
  return rows
    .filter((row) => row.issuePublishedAt || roles.isApprover || row.issueCreatedBy === actor.userId)
    .map(({ issuePublishedAt: _published, issueCreatedBy: _createdBy, ...link }) => link)
}

// Links are made by people only. Blocking runs between work items and cannot loop. Only a bug is found in a story.
export async function addLink(db: SQL, scope: IssueScope, actor: Actor, fromRef: string, toRef: string, kind: LinkKind): Promise<void> {
  const from = await loadForWork(db, scope, actor, fromRef, false)
  if (!(LINK_KINDS as readonly string[]).includes(kind)) throw invalid()
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const to = await loadVisible(db, scope, actor, roles, toRef)
  if (from.id === to.id) throw invalid()
  if (kind === 'blocks' && (from.type === 'epic' || to.type === 'epic' || (await blocksReach(db, to.id, from.id)))) throw invalid()
  if (kind === 'found_in' && (from.type !== 'bug' || to.type !== 'story')) throw invalid()
  await insertLinkRow(db, { id: randomUUID(), fromId: from.id, toId: to.id, kind, createdBy: actor.userId })
  await logEvent(db, scope, actor, from.id, 'issue.link_added', { kind, to: to.key })
}

export async function removeLink(db: SQL, scope: IssueScope, actor: Actor, ref: string, linkId: string): Promise<void> {
  const issue = await loadForWork(db, scope, actor, ref, false)
  const link = await findLinkRow(db, issue.id, linkId)
  if (!link) throw new AppError('ISSUE_NOT_FOUND')
  await deleteLinkRow(db, link.id)
}
