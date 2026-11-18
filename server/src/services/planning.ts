import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { insertStatusEvent } from '@/repositories/issues.repository'
import { insertPlanningEvent, listPlanningEventRows } from '@/repositories/planning-events.repository'
import { AppError } from '@/lib/errors/app-error'
import { findRole } from '@/repositories/memberships.repository'
import { resolveAccess } from '@/services/access'
import { findUserById } from '@/repositories/users.repository'
import { notify } from '@/services/notifications'
import { ensureAssigneeInWorkspace, ensureWorkspaceProject } from '@/repositories/projects.repository'
import { findTaskVisibility, listUserDisciplines } from '@/repositories/planning-audience.repository'
import { isItemParticipant } from '@/repositories/planning.repository'
import {
  bumpPlanningDocumentVersion,
  countDocumentDependents,
  deletePlanningDocumentRows,
  findPlanningDocument,
  findPlanningDocumentFile,
  findPlanningDocumentVersion,
  insertPlanningDocument,
  insertPlanningDocumentVersion,
  listPlanningDocumentRows,
  listPlanningDocumentVersions,
  updatePlanningDocumentStatus,
} from '@/repositories/planning-documents.repository'
import {
  findItemDesignApprovedAt,
  findPlanningItem,
  findTaskAssignee,
  insertPlanningItem,
  insertTaskDraft,
  listPlanningItemRows,
  listPlanningTaskRows,
  publishEpicRows,
  rebaseEpicSource,
  replacePlanningParticipants,
  updatePlanningItemFields,
  updateTaskDraftRow,
} from '@/repositories/planning-items.repository'
import { commentExistsOnTarget, findCommentAuthor, findPlanningComment, insertPlanningComment, listPlanningCommentRows, resolvePlanningCommentRow } from '@/repositories/planning-comments.repository'
import { isWorkRole, storyStage } from '@/models/story'

export type DocumentKind = 'brd' | 'prd'
export type DocumentStatus = 'draft' | 'review_pm' | 'review_team' | 'approved' | 'superseded' | 'discarded'
export type PlanningKind = 'epic' | 'story'
export type PlanningStatus = 'draft' | 'in_design' | 'ready' | 'in_progress' | 'in_qa' | 'done'
export type TargetKind = 'document' | 'epic' | 'story' | 'task'

const documentStatuses: DocumentStatus[] = ['draft', 'review_pm', 'review_team', 'approved', 'superseded', 'discarded']
const itemStatuses: PlanningStatus[] = ['draft', 'in_design', 'ready', 'in_progress', 'in_qa', 'done']
// A client from before the agile model sends these two names. They mean the same as the new ones.
const OLD_STATUS_NAMES: Record<string, PlanningStatus> = { refinement: 'in_design', review: 'in_qa' }
const statusOf = (value: unknown): unknown => (typeof value === 'string' ? (OLD_STATUS_NAMES[value] ?? value) : value)

function validText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

// Set when the call comes through an MCP key. A key whose role holds planning tools works on planning as a PM.
// Workspace membership is still required, and a viewer stays read-only.
// The member's roles in the workspace decide which documents it reads.
export type PlanningVia = { apiKeyId: string; planning: boolean; roles?: string[] }

async function isPm(db: SQL, workspaceId: string, userId: string, via?: PlanningVia): Promise<boolean> {
  const role = (await resolveAccess(db, workspaceId, userId))?.role
  if (!role) throw new AppError('WORKSPACE_NOT_FOUND')
  if (role === 'owner') return true
  if (role === 'viewer') return false
  if (via?.planning) return true
  return (await listUserDisciplines(db, workspaceId, userId)).includes('pm')
}

export const canManagePlanning = isPm

// The tech lead reads every draft the PM reads, since it approves them. The admin reading a workspace they are not
// a member of sees the same, but writes nothing.
async function readsAsPm(db: SQL, workspaceId: string, userId: string, via?: PlanningVia): Promise<boolean> {
  if ((await isPm(db, workspaceId, userId, via)) || (await isApprover(db, workspaceId, userId))) return true
  return !via && (await resolveAccess(db, workspaceId, userId))?.viaAdmin === true
}

export async function requirePlanningPm(db: SQL, workspaceId: string, userId: string, via?: PlanningVia) {
  if (!(await isPm(db, workspaceId, userId, via))) throw new AppError('ROLE_NOT_ALLOWED')
}

// Approving a PRD, marking a story ready, and publishing an epic: the workspace owner, a PM, or a tech lead.
async function isApprover(db: SQL, workspaceId: string, userId: string): Promise<boolean> {
  const role = (await resolveAccess(db, workspaceId, userId))?.role
  if (!role) throw new AppError('WORKSPACE_NOT_FOUND')
  if (role === 'owner') return true
  if (role === 'viewer') return false
  const roles = await listUserDisciplines(db, workspaceId, userId)
  return roles.includes('pm') || roles.includes('tech_lead')
}

export const canApprovePlanning = isApprover

export async function requirePlanningApprover(db: SQL, workspaceId: string, userId: string) {
  if (!(await isApprover(db, workspaceId, userId))) throw new AppError('ROLE_NOT_ALLOWED')
}

async function event(db: SQL, workspaceId: string, actorId: string, targetKind: string, targetId: string, action: string, apiKeyId?: string, details: Record<string, unknown> = {}) {
  await insertPlanningEvent(db, { workspaceId, actorId, apiKeyId: apiKeyId ?? null, targetKind, targetId, action, details })
}

async function documentRow(db: SQL, workspaceId: string, documentId: string) {
  const row = await findPlanningDocument(db, workspaceId, documentId)
  if (!row) throw new AppError('PLANNING_NOT_FOUND')
  return row
}

// The PM and the tech lead read every document. A viewer holding the tech lead role reads the BRD and PRDs from team
// review on. Backend reads the BRD and approved PRDs. Other roles read epics, stories, and tasks only.
type DocumentAccess = 'all' | 'review' | 'approved' | 'none'

async function documentAccess(db: SQL, workspaceId: string, userId: string, via?: PlanningVia): Promise<DocumentAccess> {
  if (await readsAsPm(db, workspaceId, userId, via)) return 'all'
  const roles = via?.roles ?? (await listUserDisciplines(db, workspaceId, userId))
  if (roles.includes('tech_lead')) return 'review'
  return roles.includes('backend') ? 'approved' : 'none'
}

// A BRD is approved when a person uploads it, or when an approver confirms one an agent uploaded.
function documentVisible(access: DocumentAccess, status: string): boolean {
  if (access === 'all') return true
  if (access === 'none') return false
  if (status === 'approved') return true
  return access === 'review' && status === 'review_team'
}

export async function canReadPlanningDocuments(db: SQL, workspaceId: string, userId: string): Promise<boolean> {
  return (await documentAccess(db, workspaceId, userId)) !== 'none'
}

async function canReadDocument(db: SQL, workspaceId: string, documentId: string, userId: string, via?: PlanningVia) {
  const row = await documentRow(db, workspaceId, documentId)
  if (documentVisible(await documentAccess(db, workspaceId, userId, via), row.status)) return row
  throw new AppError('PLANNING_NOT_FOUND')
}

export async function listPlanningDocuments(db: SQL, workspaceId: string, userId: string, via?: PlanningVia) {
  const access = await documentAccess(db, workspaceId, userId, via)
  if (access === 'none') return []
  // Agents work only on documents that go on, so a discarded one is left out for them.
  return (await listPlanningDocumentRows(db, workspaceId)).filter((row) => documentVisible(access, row.status) && !(via && row.status === 'discarded'))
}

export async function getPlanningDocument(db: SQL, workspaceId: string, documentId: string, userId: string, via?: PlanningVia) {
  const document = await canReadDocument(db, workspaceId, documentId, userId, via)
  return { ...document, versions: await listPlanningDocumentVersions(db, documentId) }
}

export async function getPlanningDocumentVersion(db: SQL, workspaceId: string, documentId: string, version: number, userId: string) {
  await canReadDocument(db, workspaceId, documentId, userId)
  const row = await findPlanningDocumentVersion(db, documentId, version)
  if (!row) throw new AppError('PLANNING_NOT_FOUND')
  return row
}

export async function getPlanningDocumentFile(db: SQL, workspaceId: string, documentId: string, userId: string) {
  const document = await canReadDocument(db, workspaceId, documentId, userId)
  const version = await findPlanningDocumentFile(db, documentId, document.currentVersion)
  if (!version?.fileBytes) throw new AppError('PLANNING_NOT_FOUND')
  return { bytes: version.fileBytes, fileName: String(version.fileName), mimeType: String(version.mimeType) }
}

export async function createPlanningDocument(db: SQL, workspaceId: string, actorId: string, input: { kind?: unknown; title?: unknown; content?: unknown; sourceDocumentId?: unknown; fileName?: unknown; mimeType?: unknown; fileBytes?: Uint8Array }, via?: PlanningVia) {
  await requirePlanningPm(db, workspaceId, actorId, via)
  await ensureWorkspaceProject(db, workspaceId)
  if ((input.kind !== 'brd' && input.kind !== 'prd') || !validText(input.title, 180) || !validText(input.content, 500_000) || (input.fileName !== undefined && !validText(input.fileName, 255)) || (input.mimeType !== undefined && !validText(input.mimeType, 100))) throw new AppError('PLANNING_INPUT_INVALID')
  const kind = input.kind as DocumentKind
  const sourceId = typeof input.sourceDocumentId === 'string' ? input.sourceDocumentId : null
  let sourceVersion: number | null = null
  if (kind === 'prd') {
    if (!sourceId) throw new AppError('PLANNING_INPUT_INVALID')
    const source = await documentRow(db, workspaceId, sourceId)
    if (source.kind !== 'brd') throw new AppError('PLANNING_INPUT_INVALID')
    if (source.status !== 'approved') throw new AppError('PLANNING_CONFLICT')
    sourceVersion = Number(source.currentVersion)
  } else if (sourceId) throw new AppError('PLANNING_INPUT_INVALID')
  const id = randomUUID()
  await db.begin(async (tx) => {
    await insertPlanningDocument(tx, { id, workspaceId, kind, title: String(input.title).trim(), status: kind === 'brd' && !via ? 'approved' : 'draft', sourceDocumentId: sourceId, createdBy: actorId })
    await insertPlanningDocumentVersion(tx, {
      documentId: id,
      version: 1,
      content: String(input.content).trim(),
      fileName: typeof input.fileName === 'string' ? input.fileName : null,
      mimeType: typeof input.mimeType === 'string' ? input.mimeType : null,
      fileBytes: input.fileBytes ?? null,
      sourceVersion,
      createdBy: actorId,
    })
    await event(tx, workspaceId, actorId, 'document', id, 'created', via?.apiKeyId)
  })
  return documentRow(db, workspaceId, id)
}

export async function revisePlanningDocument(db: SQL, workspaceId: string, documentId: string, actorId: string, input: { content?: unknown; expectedVersion?: unknown; title?: unknown }, apiKeyId?: string) {
  await requirePlanningPm(db, workspaceId, actorId)
  if (!validText(input.content, 500_000) || !Number.isInteger(input.expectedVersion) || (input.title !== undefined && !validText(input.title, 180))) throw new AppError('PLANNING_INPUT_INVALID')
  const current = await documentRow(db, workspaceId, documentId)
  if (Number(current.currentVersion) !== input.expectedVersion || current.status === 'superseded' || current.status === 'discarded') throw new AppError('PLANNING_CONFLICT')
  const sourceVersion = current.kind === 'prd' && current.sourceDocumentId ? (await documentRow(db, workspaceId, current.sourceDocumentId)).currentVersion : null
  await db.begin(async (tx) => {
    const title = typeof input.title === 'string' ? input.title.trim() : current.title
    const version = await bumpPlanningDocumentVersion(tx, { workspaceId, documentId, expectedVersion: input.expectedVersion as number, title, status: current.kind === 'brd' ? 'approved' : 'draft' })
    if (version === undefined) throw new AppError('PLANNING_CONFLICT')
    await insertPlanningDocumentVersion(tx, { documentId, version, content: String(input.content).trim(), sourceVersion, createdBy: actorId })
    await event(tx, workspaceId, actorId, 'document', documentId, 'revised', apiKeyId)
  })
  return documentRow(db, workspaceId, documentId)
}

export async function setPlanningDocumentStatus(db: SQL, workspaceId: string, documentId: string, actorId: string, status: unknown) {
  if (status === 'approved' || status === 'discarded') await requirePlanningApprover(db, workspaceId, actorId)
  else await requirePlanningPm(db, workspaceId, actorId)
  if (typeof status !== 'string' || !documentStatuses.includes(status as DocumentStatus)) throw new AppError('PLANNING_INPUT_INVALID')
  const current = await documentRow(db, workspaceId, documentId)
  // A draft or one in review that should not go on is discarded. An approved document is superseded instead.
  const next: Record<string, string[]> = { draft: ['review_pm', 'discarded'], review_pm: ['review_team', 'draft', 'discarded'], review_team: ['approved', 'draft', 'discarded'], approved: ['superseded'], superseded: [], discarded: [] }
  // A BRD an agent uploaded waits as a draft until an approver confirms or discards it.
  const allowed = current.kind === 'prd' ? next[current.status] : current.status === 'draft' ? ['approved', 'discarded'] : []
  if (!allowed?.includes(status)) throw new AppError('PLANNING_CONFLICT')
  if (status === 'approved' && current.sourceOutdated) throw new AppError('PLANNING_CONFLICT')
  await db.begin(async (tx) => {
    const approved = status === 'approved'
    const updated = await updatePlanningDocumentStatus(tx, { workspaceId, documentId, from: current.status, version: current.currentVersion, status, approvedBy: approved ? actorId : null, approvedAt: approved ? new Date() : null })
    if (!updated) throw new AppError('PLANNING_CONFLICT')
    await event(tx, workspaceId, actorId, 'document', documentId, `status:${status}`, undefined, { from: current.status, to: status, version: current.currentVersion })
  })
  return documentRow(db, workspaceId, documentId)
}

// Only a draft or a discarded document goes, and only when no PRD, epic, or story was drafted from it.
export async function deletePlanningDocument(db: SQL, workspaceId: string, documentId: string, actorId: string) {
  await requirePlanningPm(db, workspaceId, actorId)
  const current = await documentRow(db, workspaceId, documentId)
  if (current.status !== 'draft' && current.status !== 'discarded') throw new AppError('PLANNING_CONFLICT')
  if ((await countDocumentDependents(db, workspaceId, documentId)) > 0) throw new AppError('PLANNING_DOCUMENT_IN_USE')
  await db.begin(async (tx) => {
    await deletePlanningDocumentRows(tx, workspaceId, documentId)
    await event(tx, workspaceId, actorId, 'document', documentId, 'deleted', undefined, { kind: current.kind, title: current.title })
  })
}

async function itemRow(db: SQL, workspaceId: string, itemId: string) {
  const row = await findPlanningItem(db, workspaceId, itemId)
  if (!row) throw new AppError('PLANNING_NOT_FOUND')
  return row
}

async function canReadItem(db: SQL, workspaceId: string, itemId: string, userId: string, via?: PlanningVia) {
  const row = await itemRow(db, workspaceId, itemId)
  // Every member reads published epics and stories. Drafts stay with the PM and the tech lead.
  if (row.publishedAt || (await readsAsPm(db, workspaceId, userId, via))) return row
  throw new AppError('PLANNING_NOT_FOUND')
}

export async function getPlanningItem(db: SQL, workspaceId: string, itemId: string, userId: string, via?: PlanningVia) {
  return canReadItem(db, workspaceId, itemId, userId, via)
}

export async function listPlanningItems(db: SQL, workspaceId: string, userId: string, via?: PlanningVia) {
  const rows = await listPlanningItemRows(db, workspaceId, await readsAsPm(db, workspaceId, userId, via))
  return rows.map(({ designApprovedAt, designCount, ...item }) => (item.kind === 'story' ? { ...item, stage: storyStage(item.status, designApprovedAt, designCount) } : item))
}

export async function createPlanningItem(db: SQL, workspaceId: string, actorId: string, input: { kind?: unknown; parentId?: unknown; title?: unknown; description?: unknown; acceptanceCriteria?: unknown; sourceDocumentId?: unknown; sourceSection?: unknown; participantIds?: unknown }, via?: PlanningVia) {
  await requirePlanningPm(db, workspaceId, actorId, via)
  await ensureWorkspaceProject(db, workspaceId)
  if ((input.kind !== 'epic' && input.kind !== 'story') || !validText(input.title, 180) || (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 20_000)) || (input.acceptanceCriteria !== undefined && (typeof input.acceptanceCriteria !== 'string' || input.acceptanceCriteria.length > 20_000)) || typeof input.sourceDocumentId !== 'string' || (input.sourceSection !== undefined && (typeof input.sourceSection !== 'string' || input.sourceSection.length > 500)) || (input.participantIds !== undefined && (!Array.isArray(input.participantIds) || input.participantIds.length > 50 || input.participantIds.some((id) => typeof id !== 'string')))) throw new AppError('PLANNING_INPUT_INVALID')
  const document = await documentRow(db, workspaceId, input.sourceDocumentId as string)
  if (document.kind !== 'prd' || document.status !== 'approved' || document.sourceOutdated) throw new AppError('PLANNING_CONFLICT')
  if (typeof input.sourceSection === 'string' && input.sourceSection.trim() && !String(document.content).includes(input.sourceSection.trim())) throw new AppError('PLANNING_INPUT_INVALID')
  let parentId: string | null = null
  if (input.kind === 'story') {
    if (typeof input.parentId !== 'string') throw new AppError('PLANNING_INPUT_INVALID')
    const parent = await itemRow(db, workspaceId, input.parentId)
    if (parent.kind !== 'epic' || parent.sourceDocumentId !== input.sourceDocumentId || parent.publishedAt) throw new AppError('PLANNING_CONFLICT')
    parentId = parent.id
  } else if (input.parentId !== undefined) throw new AppError('PLANNING_INPUT_INVALID')
  const participants = [...new Set((input.participantIds ?? []) as string[])]
  for (const id of participants) if (!(await ensureAssigneeInWorkspace(db, workspaceId, id))) throw new AppError('PLANNING_INPUT_INVALID')
  const id = randomUUID()
  await db.begin(async (tx) => {
    await insertPlanningItem(tx, {
      id,
      workspaceId,
      kind: input.kind as PlanningKind,
      parentId,
      title: String(input.title).trim(),
      description: typeof input.description === 'string' ? input.description.trim() : '',
      acceptanceCriteria: typeof input.acceptanceCriteria === 'string' ? input.acceptanceCriteria.trim() : '',
      sourceDocumentId: document.id,
      sourceVersion: document.currentVersion,
      sourceSection: typeof input.sourceSection === 'string' ? input.sourceSection.trim() : null,
      createdBy: actorId,
    })
    await replacePlanningParticipants(tx, id, participants, { clear: false })
    await event(tx, workspaceId, actorId, input.kind as PlanningKind, id, 'draft_created', via?.apiKeyId)
  })
  return itemRow(db, workspaceId, id)
}

export async function updatePlanningItem(db: SQL, workspaceId: string, itemId: string, actorId: string, rawInput: { title?: unknown; description?: unknown; acceptanceCriteria?: unknown; status?: unknown; participantIds?: unknown }) {
  const input = { ...rawInput, status: statusOf(rawInput.status) }
  const onlyMarksReady = input.status === 'ready' && Object.entries(input).every(([key, value]) => key === 'status' || value === undefined)
  if (onlyMarksReady) await requirePlanningApprover(db, workspaceId, actorId)
  else await requirePlanningPm(db, workspaceId, actorId)
  const current = await itemRow(db, workspaceId, itemId)
  if (input.title !== undefined && !validText(input.title, 180)) throw new AppError('PLANNING_INPUT_INVALID')
  if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 20_000)) throw new AppError('PLANNING_INPUT_INVALID')
  if (input.acceptanceCriteria !== undefined && (typeof input.acceptanceCriteria !== 'string' || input.acceptanceCriteria.length > 20_000)) throw new AppError('PLANNING_INPUT_INVALID')
  if (input.status !== undefined && (typeof input.status !== 'string' || !itemStatuses.includes(input.status as PlanningStatus))) throw new AppError('PLANNING_INPUT_INVALID')
  if (input.participantIds !== undefined && (!Array.isArray(input.participantIds) || input.participantIds.length > 50 || input.participantIds.some((id) => typeof id !== 'string'))) throw new AppError('PLANNING_INPUT_INVALID')
  // An epic has no status of its own, so a status sent for it is left alone. Its status follows its stories.
  const storyStatus = current.kind === 'story' ? input.status : undefined
  const next: Record<string, string[]> = { draft: ['in_design'], in_design: ['draft', 'ready'], ready: ['in_design', 'in_progress'], in_progress: ['in_qa'], in_qa: ['in_progress', 'done'], done: [] }
  if (storyStatus && !next[current.status]?.includes(storyStatus as string)) throw new AppError('PLANNING_CONFLICT')
  if (storyStatus && ['in_progress', 'in_qa', 'done'].includes(storyStatus as string) && !current.publishedAt) throw new AppError('PLANNING_CONFLICT')
  if (storyStatus === 'in_progress' && !(await findItemDesignApprovedAt(db, itemId))) throw new AppError('PLANNING_CONFLICT')
  if (storyStatus === 'ready' && !String(input.acceptanceCriteria ?? current.acceptanceCriteria).trim()) throw new AppError('PLANNING_CONFLICT')
  const participants = input.participantIds === undefined ? null : [...new Set(input.participantIds as string[])]
  if (participants) for (const id of participants) if (!(await ensureAssigneeInWorkspace(db, workspaceId, id))) throw new AppError('PLANNING_INPUT_INVALID')
  await db.begin(async (tx) => {
    await updatePlanningItemFields(tx, {
      workspaceId,
      itemId,
      title: typeof input.title === 'string' ? input.title.trim() : current.title,
      description: typeof input.description === 'string' ? input.description.trim() : current.description,
      acceptanceCriteria: typeof input.acceptanceCriteria === 'string' ? input.acceptanceCriteria.trim() : current.acceptanceCriteria,
      status: typeof storyStatus === 'string' ? storyStatus : current.status,
    })
    if (typeof storyStatus === 'string' && storyStatus !== current.status) await insertStatusEvent(tx, { id: randomUUID(), issueId: itemId, fromStatus: current.status, toStatus: storyStatus, actorId, apiKeyId: null })
    if (participants) await replacePlanningParticipants(tx, itemId, participants, { clear: true })
    await event(tx, workspaceId, actorId, current.kind, itemId, 'updated', undefined, { statusFrom: current.status, statusTo: input.status ?? current.status, participantsChanged: participants !== null })
  })
  return itemRow(db, workspaceId, itemId)
}

export async function createPlanningTaskDraft(db: SQL, workspaceId: string, actorId: string, input: { storyId?: unknown; title?: unknown; description?: unknown; assigneeId?: unknown; priority?: unknown; role?: unknown }, via?: PlanningVia) {
  await requirePlanningPm(db, workspaceId, actorId, via)
  if (typeof input.storyId !== 'string' || !validText(input.title, 180) || (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 8000)) || (input.assigneeId !== undefined && input.assigneeId !== null && typeof input.assigneeId !== 'string') || (input.priority !== undefined && !['low', 'medium', 'high', 'urgent'].includes(String(input.priority)))) throw new AppError('PLANNING_INPUT_INVALID')
  if (input.role !== undefined && input.role !== null && !isWorkRole(input.role)) throw new AppError('PLANNING_INPUT_INVALID')
  const story = await itemRow(db, workspaceId, input.storyId)
  if (story.kind !== 'story' || story.publishedAt) throw new AppError('PLANNING_CONFLICT')
  const assigneeId = typeof input.assigneeId === 'string' ? input.assigneeId : null
  if (!(await ensureAssigneeInWorkspace(db, workspaceId, assigneeId))) throw new AppError('PLANNING_INPUT_INVALID')
  const project = await ensureWorkspaceProject(db, workspaceId)
  const id = randomUUID()
  await db.begin(async (tx) => {
    await insertTaskDraft(tx, {
      id,
      projectId: project.id,
      storyId: story.id,
      title: String(input.title).trim(),
      description: typeof input.description === 'string' ? input.description.trim() : '',
      priority: typeof input.priority === 'string' ? input.priority : 'medium',
      assigneeId,
      createdBy: actorId,
      role: isWorkRole(input.role) ? input.role : null,
    })
    await event(tx, workspaceId, actorId, 'task', id, 'draft_created', via?.apiKeyId)
  })
  return { id, storyId: story.id, title: input.title, assigneeId }
}

export async function updatePlanningTaskDraft(db: SQL, workspaceId: string, taskId: string, actorId: string, input: { title?: unknown; description?: unknown; assigneeId?: unknown; priority?: unknown }) {
  await requirePlanningPm(db, workspaceId, actorId)
  if (input.title !== undefined && !validText(input.title, 180)) throw new AppError('PLANNING_INPUT_INVALID')
  if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 8000)) throw new AppError('PLANNING_INPUT_INVALID')
  if (input.assigneeId !== undefined && input.assigneeId !== null && typeof input.assigneeId !== 'string') throw new AppError('PLANNING_INPUT_INVALID')
  if (input.priority !== undefined && !['low', 'medium', 'high', 'urgent'].includes(String(input.priority))) throw new AppError('PLANNING_INPUT_INVALID')
  if (typeof input.assigneeId === 'string' && !(await ensureAssigneeInWorkspace(db, workspaceId, input.assigneeId))) throw new AppError('PLANNING_INPUT_INVALID')
  return db.begin(async (tx) => {
    const task = await updateTaskDraftRow(tx, {
      workspaceId,
      taskId,
      title: typeof input.title === 'string' ? input.title.trim() : null,
      description: typeof input.description === 'string' ? input.description.trim() : null,
      assigneeId: input.assigneeId === undefined ? undefined : typeof input.assigneeId === 'string' ? input.assigneeId : null,
      priority: typeof input.priority === 'string' ? input.priority : null,
    })
    if (!task) throw new AppError('PLANNING_NOT_FOUND')
    await event(tx, workspaceId, actorId, 'task', taskId, 'draft_updated')
    return task
  })
}

export async function listPlanningTasks(db: SQL, workspaceId: string, userId: string, via?: PlanningVia) {
  return listPlanningTaskRows(db, workspaceId, await readsAsPm(db, workspaceId, userId, via))
}

export async function publishPlanningEpic(db: SQL, workspaceId: string, epicId: string, actorId: string) {
  await requirePlanningApprover(db, workspaceId, actorId)
  const epic = await itemRow(db, workspaceId, epicId)
  if (epic.kind !== 'epic' || epic.publishedAt) throw new AppError('PLANNING_CONFLICT')
  if (!epic.sourceDocumentId) throw new AppError('PLANNING_CONFLICT')
  const source = await documentRow(db, workspaceId, epic.sourceDocumentId)
  if (source.status !== 'approved' || source.currentVersion !== epic.sourceVersion || source.sourceOutdated) throw new AppError('PLANNING_CONFLICT')
  await db.begin(async (tx) => {
    await publishEpicRows(tx, epicId)
    await event(tx, workspaceId, actorId, 'epic', epicId, 'published')
  })
  return itemRow(db, workspaceId, epicId)
}

export async function rebasePlanningEpic(db: SQL, workspaceId: string, epicId: string, actorId: string) {
  await requirePlanningPm(db, workspaceId, actorId)
  const epic = await itemRow(db, workspaceId, epicId)
  if (epic.kind !== 'epic' || epic.publishedAt || !epic.sourceDocumentId) throw new AppError('PLANNING_CONFLICT')
  const source = await documentRow(db, workspaceId, epic.sourceDocumentId)
  if (source.status !== 'approved' || source.sourceOutdated) throw new AppError('PLANNING_CONFLICT')
  await db.begin(async (tx) => {
    await rebaseEpicSource(tx, workspaceId, epicId, source.currentVersion)
    await event(tx, workspaceId, actorId, 'epic', epicId, 'source_reviewed', undefined, { fromVersion: epic.sourceVersion, toVersion: source.currentVersion })
  })
  return itemRow(db, workspaceId, epicId)
}

async function canReadTarget(db: SQL, workspaceId: string, targetKind: TargetKind, targetId: string, userId: string, via?: PlanningVia) {
  if (targetKind === 'document') return canReadDocument(db, workspaceId, targetId, userId, via)
  if (targetKind === 'epic' || targetKind === 'story') {
    const row = await canReadItem(db, workspaceId, targetId, userId, via)
    if (row.kind !== targetKind) throw new AppError('PLANNING_NOT_FOUND')
    return row
  }
  const task = await findTaskVisibility(db, workspaceId, targetId)
  if (!task || (!task.published && !(await readsAsPm(db, workspaceId, userId, via)))) throw new AppError('PLANNING_NOT_FOUND')
  return task
}

// Reading a discussion is open to everyone who reads its target. Writing in one is not: on a task only its assignee,
// on an epic or story its participants and approvers, and on a document everyone who reads it.
async function requireCommentWriter(db: SQL, workspaceId: string, targetKind: TargetKind, targetId: string, userId: string, via?: PlanningVia) {
  if (targetKind === 'document' || (await isPm(db, workspaceId, userId, via))) return
  if (targetKind === 'task') {
    if ((await findTaskVisibility(db, workspaceId, targetId))?.assigneeId === userId) return
  } else if ((await isApprover(db, workspaceId, userId)) || (await isItemParticipant(db, workspaceId, targetId, userId))) return
  throw new AppError('ROLE_NOT_ALLOWED')
}

export async function listPlanningComments(db: SQL, workspaceId: string, actorId: string, targetKind: TargetKind, targetId: string, via?: PlanningVia) {
  await canReadTarget(db, workspaceId, targetKind, targetId, actorId, via)
  return listPlanningCommentRows(db, workspaceId, targetKind, targetId)
}

export async function addPlanningComment(db: SQL, workspaceId: string, actorId: string, targetKind: TargetKind, targetId: string, input: { body?: unknown; parentId?: unknown; isDecision?: unknown; mentionIds?: unknown }, via?: PlanningVia) {
  await canReadTarget(db, workspaceId, targetKind, targetId, actorId, via)
  await requireCommentWriter(db, workspaceId, targetKind, targetId, actorId, via)
  if (input.mentionIds !== undefined && (!Array.isArray(input.mentionIds) || input.mentionIds.length > 20 || input.mentionIds.some((id) => typeof id !== 'string'))) throw new AppError('PLANNING_INPUT_INVALID')
  if (!validText(input.body, 8000) || (input.parentId !== undefined && typeof input.parentId !== 'string') || (input.isDecision !== undefined && typeof input.isDecision !== 'boolean')) throw new AppError('PLANNING_INPUT_INVALID')
  if (input.isDecision && !(await isPm(db, workspaceId, actorId, via))) throw new AppError('ROLE_NOT_ALLOWED')
  if (typeof input.parentId === 'string' && !(await commentExistsOnTarget(db, workspaceId, input.parentId, targetKind, targetId))) throw new AppError('PLANNING_INPUT_INVALID')
  const id = randomUUID()
  const parentId = typeof input.parentId === 'string' ? input.parentId : null
  await db.begin(async (tx) => {
    await insertPlanningComment(tx, { id, workspaceId, targetKind, targetId, parentId, body: String(input.body).trim(), isDecision: input.isDecision === true, createdBy: actorId })
    await event(tx, workspaceId, actorId, targetKind, targetId, 'commented', via?.apiKeyId)
  })
  await notifyCommentAudience(db, workspaceId, actorId, { targetKind, targetId, parentId, body: String(input.body).trim(), mentionIds: (input.mentionIds as string[] | undefined) ?? [] })
  return { id }
}

// Who hears about a new comment: people it mentions, the author of the comment it answers, and the assignee of the
// task it is on. Each person gets one notification, the most specific one. The author and non-members get none.
async function notifyCommentAudience(db: SQL, workspaceId: string, actorId: string, comment: { targetKind: TargetKind; targetId: string; parentId: string | null; body: string; mentionIds: string[] }) {
  const audience = new Map<string, 'comment_mention' | 'comment_reply' | 'task_comment'>()
  for (const id of comment.mentionIds) audience.set(id, 'comment_mention')
  if (comment.parentId) {
    const author = await findCommentAuthor(db, comment.parentId)
    if (author && !audience.has(author)) audience.set(author, 'comment_reply')
  }
  if (comment.targetKind === 'task') {
    const assigneeId = await findTaskAssignee(db, comment.targetId)
    if (assigneeId && !audience.has(assigneeId)) audience.set(assigneeId, 'task_comment')
  }
  audience.delete(actorId)
  if (audience.size === 0) return
  const actor = await findUserById(db, actorId)
  for (const [userId, kind] of audience) {
    if (!(await findRole(db, workspaceId, userId))) continue
    await notify(db, userId, kind, `/w/${workspaceId}/projects`, { actor: actor?.email.split('@')[0] ?? '', targetKind: comment.targetKind, preview: comment.body.slice(0, 140) })
  }
}

export async function resolvePlanningComment(db: SQL, workspaceId: string, actorId: string, commentId: string) {
  const comment = await findPlanningComment(db, workspaceId, commentId)
  if (!comment) throw new AppError('PLANNING_NOT_FOUND')
  await canReadTarget(db, workspaceId, comment.targetKind as TargetKind, comment.targetId, actorId)
  if (comment.createdBy !== actorId && !(await isPm(db, workspaceId, actorId))) throw new AppError('ROLE_NOT_ALLOWED')
  await db.begin(async (tx) => {
    await resolvePlanningCommentRow(tx, workspaceId, commentId, actorId)
    await event(tx, workspaceId, actorId, comment.targetKind, comment.targetId, 'comment_resolved')
  })
}

export async function listPlanningEvents(db: SQL, workspaceId: string, actorId: string) {
  await requirePlanningPm(db, workspaceId, actorId)
  return listPlanningEventRows(db, workspaceId, 200)
}
