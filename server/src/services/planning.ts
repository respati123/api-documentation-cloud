import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { findRole } from '@/repositories/memberships.repository'
import { findUserById } from '@/repositories/users.repository'
import { notify } from '@/services/notifications'
import { ensureAssigneeInWorkspace, ensureWorkspaceProject } from '@/repositories/projects.repository'
import { isWorkRole, storyStage } from '@/models/story'

export type DocumentKind = 'brd' | 'prd'
export type DocumentStatus = 'draft' | 'review_pm' | 'review_team' | 'approved' | 'superseded'
export type PlanningKind = 'epic' | 'story'
export type PlanningStatus = 'draft' | 'refinement' | 'ready' | 'in_progress' | 'review' | 'done'
export type TargetKind = 'document' | 'epic' | 'story' | 'task'

const documentStatuses: DocumentStatus[] = ['draft', 'review_pm', 'review_team', 'approved', 'superseded']
const itemStatuses: PlanningStatus[] = ['draft', 'refinement', 'ready', 'in_progress', 'review', 'done']

function validText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

// Set when the call comes through an MCP key. A key whose role holds planning tools works on planning as a PM,
// even where the member's workspace role alone would not allow it. Workspace membership is still required.
export type PlanningVia = { apiKeyId: string; planning: boolean }

async function isPm(db: SQL, workspaceId: string, userId: string, via?: PlanningVia): Promise<boolean> {
  const role = await findRole(db, workspaceId, userId)
  if (!role) throw new AppError('WORKSPACE_NOT_FOUND')
  if (role === 'owner' || via?.planning) return true
  if (role === 'viewer') return false
  const [row] = await db`SELECT 1 FROM project_members pm JOIN projects p ON p.id = pm.project_id WHERE p.workspace_id = ${workspaceId} AND pm.user_id = ${userId} AND pm.discipline = 'pm' LIMIT 1`
  return Boolean(row)
}

export const canManagePlanning = isPm

export async function requirePlanningPm(db: SQL, workspaceId: string, userId: string, via?: PlanningVia) {
  if (!(await isPm(db, workspaceId, userId, via))) throw new AppError('ROLE_NOT_ALLOWED')
}

// Approving a PRD, marking a story ready, and publishing an epic: the workspace owner, a PM, or a tech lead.
async function isApprover(db: SQL, workspaceId: string, userId: string): Promise<boolean> {
  const role = await findRole(db, workspaceId, userId)
  if (!role) throw new AppError('WORKSPACE_NOT_FOUND')
  if (role === 'owner') return true
  if (role === 'viewer') return false
  const [row] = await db`SELECT 1 FROM project_members pm JOIN projects p ON p.id = pm.project_id WHERE p.workspace_id = ${workspaceId} AND pm.user_id = ${userId} AND pm.discipline IN ('pm', 'tech_lead') LIMIT 1`
  return Boolean(row)
}

export const canApprovePlanning = isApprover

export async function requirePlanningApprover(db: SQL, workspaceId: string, userId: string) {
  if (!(await isApprover(db, workspaceId, userId))) throw new AppError('ROLE_NOT_ALLOWED')
}

async function event(db: SQL, workspaceId: string, actorId: string, targetKind: string, targetId: string, action: string, apiKeyId?: string, details: Record<string, unknown> = {}) {
  await db`INSERT INTO planning_events (id, workspace_id, actor_id, api_key_id, target_kind, target_id, action, details) VALUES (${randomUUID()}, ${workspaceId}, ${actorId}, ${apiKeyId ?? null}, ${targetKind}, ${targetId}, ${action}, (${JSON.stringify(details)}::text)::jsonb)`
}

async function documentRow(db: SQL, workspaceId: string, documentId: string) {
  const [row] = await db`SELECT d.id, d.workspace_id AS "workspaceId", d.kind, d.title, d.status, d.current_version AS "currentVersion", d.source_document_id AS "sourceDocumentId", d.approved_by AS "approvedBy", d.approved_at AS "approvedAt", d.created_at AS "createdAt", d.updated_at AS "updatedAt", v.content, v.file_name AS "fileName", v.mime_type AS "mimeType", v.source_version AS "sourceVersion", (s.current_version > v.source_version) AS "sourceOutdated" FROM planning_documents d JOIN planning_document_versions v ON v.document_id = d.id AND v.version = d.current_version LEFT JOIN planning_documents s ON s.id = d.source_document_id WHERE d.id = ${documentId} AND d.workspace_id = ${workspaceId}`
  if (!row) throw new AppError('PLANNING_NOT_FOUND')
  return row
}

async function canReadDocument(db: SQL, workspaceId: string, documentId: string, userId: string, via?: PlanningVia) {
  const row = await documentRow(db, workspaceId, documentId)
  if (await isPm(db, workspaceId, userId, via)) return row
  if (row.kind === 'prd' && (row.status === 'review_team' || row.status === 'approved')) return row
  throw new AppError('PLANNING_NOT_FOUND')
}

export async function listPlanningDocuments(db: SQL, workspaceId: string, userId: string, via?: PlanningVia) {
  const pm = await isPm(db, workspaceId, userId, via)
  return db`SELECT d.id, d.kind, d.title, d.status, d.current_version AS "currentVersion", d.source_document_id AS "sourceDocumentId", d.approved_at AS "approvedAt", d.updated_at AS "updatedAt", (s.current_version > v.source_version) AS "sourceOutdated" FROM planning_documents d JOIN planning_document_versions v ON v.document_id = d.id AND v.version = d.current_version LEFT JOIN planning_documents s ON s.id = d.source_document_id WHERE d.workspace_id = ${workspaceId} AND (${pm} OR (d.kind = 'prd' AND d.status IN ('review_team', 'approved'))) ORDER BY d.updated_at DESC LIMIT 100`
}

export async function getPlanningDocument(db: SQL, workspaceId: string, documentId: string, userId: string, via?: PlanningVia) {
  const document = await canReadDocument(db, workspaceId, documentId, userId, via)
  const versions = await db`SELECT version, file_name AS "fileName", mime_type AS "mimeType", source_version AS "sourceVersion", created_at AS "createdAt" FROM planning_document_versions WHERE document_id = ${documentId} ORDER BY version DESC`
  return { ...document, versions }
}

export async function getPlanningDocumentVersion(db: SQL, workspaceId: string, documentId: string, version: number, userId: string) {
  await canReadDocument(db, workspaceId, documentId, userId)
  const [row] = await db`SELECT version, content, file_name AS "fileName", mime_type AS "mimeType", source_version AS "sourceVersion", created_at AS "createdAt" FROM planning_document_versions WHERE document_id = ${documentId} AND version = ${version}`
  if (!row) throw new AppError('PLANNING_NOT_FOUND')
  return row
}

export async function getPlanningDocumentFile(db: SQL, workspaceId: string, documentId: string, userId: string) {
  const document = await canReadDocument(db, workspaceId, documentId, userId)
  const [version] = await db`SELECT file_bytes AS "fileBytes", file_name AS "fileName", mime_type AS "mimeType" FROM planning_document_versions WHERE document_id = ${documentId} AND version = ${document.currentVersion}`
  if (!version?.fileBytes) throw new AppError('PLANNING_NOT_FOUND')
  return { bytes: version.fileBytes as Uint8Array, fileName: String(version.fileName), mimeType: String(version.mimeType) }
}

export async function createPlanningDocument(db: SQL, workspaceId: string, actorId: string, input: { kind?: unknown; title?: unknown; content?: unknown; sourceDocumentId?: unknown; fileName?: unknown; mimeType?: unknown; fileBytes?: Uint8Array }, via?: PlanningVia) {
  await requirePlanningPm(db, workspaceId, actorId, via)
  if ((input.kind !== 'brd' && input.kind !== 'prd') || !validText(input.title, 180) || !validText(input.content, 500_000) || (input.fileName !== undefined && !validText(input.fileName, 255)) || (input.mimeType !== undefined && !validText(input.mimeType, 100))) throw new AppError('PLANNING_INPUT_INVALID')
  const kind = input.kind as DocumentKind
  const sourceId = typeof input.sourceDocumentId === 'string' ? input.sourceDocumentId : null
  let sourceVersion: number | null = null
  if (kind === 'prd') {
    if (!sourceId) throw new AppError('PLANNING_INPUT_INVALID')
    const source = await documentRow(db, workspaceId, sourceId)
    if (source.kind !== 'brd') throw new AppError('PLANNING_INPUT_INVALID')
    sourceVersion = Number(source.currentVersion)
  } else if (sourceId) throw new AppError('PLANNING_INPUT_INVALID')
  const id = randomUUID()
  await db.begin(async (tx) => {
    await tx`INSERT INTO planning_documents (id, workspace_id, kind, title, status, source_document_id, created_by) VALUES (${id}, ${workspaceId}, ${kind}, ${String(input.title).trim()}, ${kind === 'brd' ? 'approved' : 'draft'}, ${sourceId}, ${actorId})`
    await tx`INSERT INTO planning_document_versions (document_id, version, content, file_name, mime_type, file_bytes, source_version, created_by) VALUES (${id}, 1, ${String(input.content).trim()}, ${typeof input.fileName === 'string' ? input.fileName : null}, ${typeof input.mimeType === 'string' ? input.mimeType : null}, ${input.fileBytes ?? null}, ${sourceVersion}, ${actorId})`
    await event(tx, workspaceId, actorId, 'document', id, 'created', via?.apiKeyId)
  })
  return documentRow(db, workspaceId, id)
}

export async function revisePlanningDocument(db: SQL, workspaceId: string, documentId: string, actorId: string, input: { content?: unknown; expectedVersion?: unknown; title?: unknown }, apiKeyId?: string) {
  await requirePlanningPm(db, workspaceId, actorId)
  if (!validText(input.content, 500_000) || !Number.isInteger(input.expectedVersion) || (input.title !== undefined && !validText(input.title, 180))) throw new AppError('PLANNING_INPUT_INVALID')
  const current = await documentRow(db, workspaceId, documentId)
  if (Number(current.currentVersion) !== input.expectedVersion || current.status === 'superseded') throw new AppError('PLANNING_CONFLICT')
  const sourceVersion = current.kind === 'prd' && current.sourceDocumentId ? (await documentRow(db, workspaceId, current.sourceDocumentId)).currentVersion : null
  await db.begin(async (tx) => {
    const [updated] = await tx`UPDATE planning_documents SET title = ${typeof input.title === 'string' ? input.title.trim() : current.title}, current_version = current_version + 1, status = ${current.kind === 'brd' ? 'approved' : 'draft'}, approved_by = NULL, approved_at = NULL, updated_at = now() WHERE id = ${documentId} AND workspace_id = ${workspaceId} AND current_version = ${input.expectedVersion} RETURNING current_version AS "currentVersion"`
    if (!updated) throw new AppError('PLANNING_CONFLICT')
    await tx`INSERT INTO planning_document_versions (document_id, version, content, source_version, created_by) VALUES (${documentId}, ${updated.currentVersion}, ${String(input.content).trim()}, ${sourceVersion}, ${actorId})`
    await event(tx, workspaceId, actorId, 'document', documentId, 'revised', apiKeyId)
  })
  return documentRow(db, workspaceId, documentId)
}

export async function setPlanningDocumentStatus(db: SQL, workspaceId: string, documentId: string, actorId: string, status: unknown) {
  if (status === 'approved') await requirePlanningApprover(db, workspaceId, actorId)
  else await requirePlanningPm(db, workspaceId, actorId)
  if (typeof status !== 'string' || !documentStatuses.includes(status as DocumentStatus)) throw new AppError('PLANNING_INPUT_INVALID')
  const current = await documentRow(db, workspaceId, documentId)
  const next: Record<string, string[]> = { draft: ['review_pm'], review_pm: ['review_team', 'draft'], review_team: ['approved', 'draft'], approved: ['superseded'], superseded: [] }
  if (current.kind !== 'prd' || !next[current.status]?.includes(status)) throw new AppError('PLANNING_CONFLICT')
  if (status === 'approved' && current.sourceOutdated) throw new AppError('PLANNING_CONFLICT')
  await db.begin(async (tx) => {
    const [updated] = await tx`UPDATE planning_documents SET status = ${status}, approved_by = ${status === 'approved' ? actorId : null}, approved_at = ${status === 'approved' ? new Date() : null}, updated_at = now() WHERE id = ${documentId} AND workspace_id = ${workspaceId} AND status = ${current.status} AND current_version = ${current.currentVersion} RETURNING id`
    if (!updated) throw new AppError('PLANNING_CONFLICT')
    await event(tx, workspaceId, actorId, 'document', documentId, `status:${status}`, undefined, { from: current.status, to: status, version: current.currentVersion })
  })
  return documentRow(db, workspaceId, documentId)
}

async function itemRow(db: SQL, workspaceId: string, itemId: string) {
  const [row] = await db`SELECT id, workspace_id AS "workspaceId", kind, parent_id AS "parentId", title, description, acceptance_criteria AS "acceptanceCriteria", status, published_at AS "publishedAt", source_document_id AS "sourceDocumentId", source_version AS "sourceVersion", source_section AS "sourceSection", created_at AS "createdAt", updated_at AS "updatedAt" FROM planning_items WHERE id = ${itemId} AND workspace_id = ${workspaceId}`
  if (!row) throw new AppError('PLANNING_NOT_FOUND')
  return row
}

async function canReadItem(db: SQL, workspaceId: string, itemId: string, userId: string, via?: PlanningVia) {
  const row = await itemRow(db, workspaceId, itemId)
  if (await isPm(db, workspaceId, userId, via)) return row
  if (row.publishedAt && (await isApprover(db, workspaceId, userId))) return row
  if (!row.publishedAt) throw new AppError('PLANNING_NOT_FOUND')
  const [participant] = await db`SELECT 1 FROM planning_participants pp JOIN planning_items i ON i.id = pp.item_id WHERE pp.user_id = ${userId} AND i.workspace_id = ${workspaceId} AND (i.id = ${itemId} OR (i.kind = 'story' AND i.parent_id = ${itemId})) LIMIT 1`
  if (!participant) throw new AppError('PLANNING_NOT_FOUND')
  return row
}

export async function getPlanningItem(db: SQL, workspaceId: string, itemId: string, userId: string, via?: PlanningVia) {
  return canReadItem(db, workspaceId, itemId, userId, via)
}

export async function listPlanningItems(db: SQL, workspaceId: string, userId: string, via?: PlanningVia) {
  const pm = await isPm(db, workspaceId, userId, via)
  const rows = await db`SELECT i.id, i.kind, i.parent_id AS "parentId", i.title, i.description, i.acceptance_criteria AS "acceptanceCriteria", i.status, i.published_at AS "publishedAt", i.source_document_id AS "sourceDocumentId", i.source_version AS "sourceVersion", i.source_section AS "sourceSection", (d.current_version > i.source_version) AS "sourceOutdated", i.created_at AS "createdAt", i.design_approved_at AS "designApprovedAt", (SELECT count(*)::int FROM story_designs sd WHERE sd.story_id = i.id) AS "designCount", COALESCE((SELECT array_agg(pp.user_id) FROM planning_participants pp WHERE pp.item_id = i.id), ARRAY[]::text[]) AS "participantIds" FROM planning_items i LEFT JOIN planning_documents d ON d.id = i.source_document_id WHERE i.workspace_id = ${workspaceId} AND (${pm} OR (i.published_at IS NOT NULL AND (EXISTS (SELECT 1 FROM planning_participants pp WHERE pp.item_id = i.id AND pp.user_id = ${userId}) OR (i.kind = 'epic' AND EXISTS (SELECT 1 FROM planning_items s JOIN planning_participants pp ON pp.item_id = s.id WHERE s.parent_id = i.id AND s.published_at IS NOT NULL AND pp.user_id = ${userId}))))) ORDER BY i.created_at LIMIT 500`
  return rows.map(({ designApprovedAt, designCount, ...item }: Record<string, unknown> & { kind: string; status: string; designApprovedAt: Date | null; designCount: number }) =>
    item.kind === 'story' ? { ...item, stage: storyStage(item.status, designApprovedAt, designCount) } : item,
  )
}

export async function createPlanningItem(db: SQL, workspaceId: string, actorId: string, input: { kind?: unknown; parentId?: unknown; title?: unknown; description?: unknown; acceptanceCriteria?: unknown; sourceDocumentId?: unknown; sourceSection?: unknown; participantIds?: unknown }, via?: PlanningVia) {
  await requirePlanningPm(db, workspaceId, actorId, via)
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
    await tx`INSERT INTO planning_items (id, workspace_id, kind, parent_id, title, description, acceptance_criteria, source_document_id, source_version, source_section, created_by) VALUES (${id}, ${workspaceId}, ${input.kind}, ${parentId}, ${String(input.title).trim()}, ${typeof input.description === 'string' ? input.description.trim() : ''}, ${typeof input.acceptanceCriteria === 'string' ? input.acceptanceCriteria.trim() : ''}, ${document.id}, ${document.currentVersion}, ${typeof input.sourceSection === 'string' ? input.sourceSection.trim() : null}, ${actorId})`
    for (const userId of participants) await tx`INSERT INTO planning_participants (item_id, user_id) VALUES (${id}, ${userId})`
    await event(tx, workspaceId, actorId, input.kind as PlanningKind, id, 'draft_created', via?.apiKeyId)
  })
  return itemRow(db, workspaceId, id)
}

export async function updatePlanningItem(db: SQL, workspaceId: string, itemId: string, actorId: string, input: { title?: unknown; description?: unknown; acceptanceCriteria?: unknown; status?: unknown; participantIds?: unknown }) {
  const onlyMarksReady = input.status === 'ready' && Object.entries(input).every(([key, value]) => key === 'status' || value === undefined)
  if (onlyMarksReady) await requirePlanningApprover(db, workspaceId, actorId)
  else await requirePlanningPm(db, workspaceId, actorId)
  const current = await itemRow(db, workspaceId, itemId)
  if (input.title !== undefined && !validText(input.title, 180)) throw new AppError('PLANNING_INPUT_INVALID')
  if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 20_000)) throw new AppError('PLANNING_INPUT_INVALID')
  if (input.acceptanceCriteria !== undefined && (typeof input.acceptanceCriteria !== 'string' || input.acceptanceCriteria.length > 20_000)) throw new AppError('PLANNING_INPUT_INVALID')
  if (input.status !== undefined && (typeof input.status !== 'string' || !itemStatuses.includes(input.status as PlanningStatus))) throw new AppError('PLANNING_INPUT_INVALID')
  if (input.participantIds !== undefined && (!Array.isArray(input.participantIds) || input.participantIds.length > 50 || input.participantIds.some((id) => typeof id !== 'string'))) throw new AppError('PLANNING_INPUT_INVALID')
  const next: Record<string, string[]> = { draft: ['refinement'], refinement: ['draft', 'ready'], ready: ['refinement', 'in_progress'], in_progress: ['review'], review: ['in_progress', 'done'], done: [] }
  if (input.status && !next[current.status]?.includes(input.status as string)) throw new AppError('PLANNING_CONFLICT')
  if (input.status && ['in_progress', 'review', 'done'].includes(input.status as string) && !current.publishedAt) throw new AppError('PLANNING_CONFLICT')
  if (input.status === 'in_progress' && current.kind === 'story') {
    const [design] = await db`SELECT design_approved_at AS "approvedAt" FROM planning_items WHERE id = ${itemId}`
    if (!design?.approvedAt) throw new AppError('PLANNING_CONFLICT')
  }
  if (input.status === 'ready' && current.kind === 'story' && !String(input.acceptanceCriteria ?? current.acceptanceCriteria).trim()) throw new AppError('PLANNING_CONFLICT')
  const participants = input.participantIds === undefined ? null : [...new Set(input.participantIds as string[])]
  if (participants) for (const id of participants) if (!(await ensureAssigneeInWorkspace(db, workspaceId, id))) throw new AppError('PLANNING_INPUT_INVALID')
  await db.begin(async (tx) => {
    await tx`UPDATE planning_items SET title = ${typeof input.title === 'string' ? input.title.trim() : current.title}, description = ${typeof input.description === 'string' ? input.description.trim() : current.description}, acceptance_criteria = ${typeof input.acceptanceCriteria === 'string' ? input.acceptanceCriteria.trim() : current.acceptanceCriteria}, status = ${typeof input.status === 'string' ? input.status : current.status}, updated_at = now() WHERE id = ${itemId} AND workspace_id = ${workspaceId}`
    if (participants) {
      await tx`DELETE FROM planning_participants WHERE item_id = ${itemId}`
      for (const userId of participants) await tx`INSERT INTO planning_participants (item_id, user_id) VALUES (${itemId}, ${userId})`
    }
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
    await tx`INSERT INTO tasks (id, project_id, story_id, title, description, status, priority, assignee_id, created_by, published_at, role) VALUES (${id}, ${project.id}, ${story.id}, ${String(input.title).trim()}, ${typeof input.description === 'string' ? input.description.trim() : ''}, 'backlog', ${typeof input.priority === 'string' ? input.priority : 'medium'}, ${assigneeId}, ${actorId}, NULL, ${isWorkRole(input.role) ? input.role : null})`
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
    const [task] = await tx`UPDATE tasks SET title = coalesce(${typeof input.title === 'string' ? input.title.trim() : null}, title), description = coalesce(${typeof input.description === 'string' ? input.description.trim() : null}, description), assignee_id = CASE WHEN ${input.assigneeId === undefined} THEN assignee_id ELSE ${typeof input.assigneeId === 'string' ? input.assigneeId : null} END, priority = coalesce(${typeof input.priority === 'string' ? input.priority : null}, priority), updated_at = now() WHERE id = ${taskId} AND published_at IS NULL AND story_id IN (SELECT id FROM planning_items WHERE workspace_id = ${workspaceId} AND kind = 'story' AND published_at IS NULL) RETURNING id, story_id AS "storyId", title, description, priority, assignee_id AS "assigneeId"`
    if (!task) throw new AppError('PLANNING_NOT_FOUND')
    await event(tx, workspaceId, actorId, 'task', taskId, 'draft_updated')
    return task
  })
}

export async function listPlanningTasks(db: SQL, workspaceId: string, userId: string, via?: PlanningVia) {
  const pm = await isPm(db, workspaceId, userId, via)
  return db`SELECT t.id, t.story_id AS "storyId", t.title, t.description, t.status, t.priority, t.assignee_id AS "assigneeId", t.published_at AS "publishedAt" FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.workspace_id = ${workspaceId} AND t.story_id IS NOT NULL AND (${pm} OR (t.published_at IS NOT NULL AND t.assignee_id = ${userId})) ORDER BY t.created_at LIMIT 500`
}

export async function publishPlanningEpic(db: SQL, workspaceId: string, epicId: string, actorId: string) {
  await requirePlanningApprover(db, workspaceId, actorId)
  const epic = await itemRow(db, workspaceId, epicId)
  if (epic.kind !== 'epic' || epic.publishedAt || epic.status !== 'ready') throw new AppError('PLANNING_CONFLICT')
  if (!epic.sourceDocumentId) throw new AppError('PLANNING_CONFLICT')
  const source = await documentRow(db, workspaceId, epic.sourceDocumentId)
  if (source.status !== 'approved' || source.currentVersion !== epic.sourceVersion || source.sourceOutdated) throw new AppError('PLANNING_CONFLICT')
  const [notReady] = await db`SELECT 1 FROM planning_items WHERE parent_id = ${epicId} AND status <> 'ready' LIMIT 1`
  if (notReady) throw new AppError('PLANNING_CONFLICT')
  const [stories] = await db`SELECT count(*)::int AS count FROM planning_items WHERE parent_id = ${epicId} AND kind = 'story'`
  const [emptyStory] = await db`SELECT 1 FROM planning_items s WHERE s.parent_id = ${epicId} AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.story_id = s.id) LIMIT 1`
  if (!stories?.count || emptyStory) throw new AppError('PLANNING_CONFLICT')
  await db.begin(async (tx) => {
    await tx`UPDATE planning_items SET published_at = now(), updated_at = now() WHERE id = ${epicId} OR parent_id = ${epicId}`
    await tx`UPDATE tasks SET published_at = now(), updated_at = now() WHERE story_id IN (SELECT id FROM planning_items WHERE parent_id = ${epicId}) AND published_at IS NULL`
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
    await tx`UPDATE planning_items SET source_version = ${source.currentVersion}, updated_at = now() WHERE workspace_id = ${workspaceId} AND (id = ${epicId} OR parent_id = ${epicId}) AND published_at IS NULL`
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
  const [task] = await db`SELECT t.id, t.assignee_id AS "assigneeId", t.published_at AS "publishedAt" FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = ${targetId} AND p.workspace_id = ${workspaceId}`
  if (!task || (!(await isPm(db, workspaceId, userId, via)) && (task.assigneeId !== userId || !task.publishedAt))) throw new AppError('PLANNING_NOT_FOUND')
  return task
}

export async function listPlanningComments(db: SQL, workspaceId: string, actorId: string, targetKind: TargetKind, targetId: string) {
  await canReadTarget(db, workspaceId, targetKind, targetId, actorId)
  return db`SELECT c.id, c.target_kind AS "targetKind", c.target_id AS "targetId", c.parent_id AS "parentId", c.body, c.is_decision AS "isDecision", c.resolved_at AS "resolvedAt", c.created_by AS "createdBy", u.email AS "authorEmail", c.created_at AS "createdAt" FROM planning_comments c JOIN users u ON u.id = c.created_by WHERE c.workspace_id = ${workspaceId} AND c.target_kind = ${targetKind} AND c.target_id = ${targetId} ORDER BY c.created_at LIMIT 500`
}

export async function addPlanningComment(db: SQL, workspaceId: string, actorId: string, targetKind: TargetKind, targetId: string, input: { body?: unknown; parentId?: unknown; isDecision?: unknown; mentionIds?: unknown }, via?: PlanningVia) {
  await canReadTarget(db, workspaceId, targetKind, targetId, actorId, via)
  if (input.mentionIds !== undefined && (!Array.isArray(input.mentionIds) || input.mentionIds.length > 20 || input.mentionIds.some((id) => typeof id !== 'string'))) throw new AppError('PLANNING_INPUT_INVALID')
  if (!validText(input.body, 8000) || (input.parentId !== undefined && typeof input.parentId !== 'string') || (input.isDecision !== undefined && typeof input.isDecision !== 'boolean')) throw new AppError('PLANNING_INPUT_INVALID')
  if (input.isDecision && !(await isPm(db, workspaceId, actorId, via))) throw new AppError('ROLE_NOT_ALLOWED')
  if (input.parentId) {
    const [parent] = await db`SELECT 1 FROM planning_comments WHERE id = ${input.parentId} AND workspace_id = ${workspaceId} AND target_kind = ${targetKind} AND target_id = ${targetId}`
    if (!parent) throw new AppError('PLANNING_INPUT_INVALID')
  }
  const id = randomUUID()
  await db.begin(async (tx) => {
    await tx`INSERT INTO planning_comments (id, workspace_id, target_kind, target_id, parent_id, body, is_decision, created_by) VALUES (${id}, ${workspaceId}, ${targetKind}, ${targetId}, ${typeof input.parentId === 'string' ? input.parentId : null}, ${String(input.body).trim()}, ${input.isDecision === true}, ${actorId})`
    await event(tx, workspaceId, actorId, targetKind, targetId, 'commented', via?.apiKeyId)
  })
  await notifyCommentAudience(db, workspaceId, actorId, { targetKind, targetId, parentId: typeof input.parentId === 'string' ? input.parentId : null, body: String(input.body).trim(), mentionIds: (input.mentionIds as string[] | undefined) ?? [] })
  return { id }
}

// Who hears about a new comment: people it mentions, the author of the comment it answers, and the assignee of the
// task it is on. Each person gets one notification, the most specific one. The author and non-members get none.
async function notifyCommentAudience(db: SQL, workspaceId: string, actorId: string, comment: { targetKind: TargetKind; targetId: string; parentId: string | null; body: string; mentionIds: string[] }) {
  const audience = new Map<string, 'comment_mention' | 'comment_reply' | 'task_comment'>()
  for (const id of comment.mentionIds) audience.set(id, 'comment_mention')
  if (comment.parentId) {
    const [parent] = await db`SELECT created_by AS "createdBy" FROM planning_comments WHERE id = ${comment.parentId}`
    if (parent && !audience.has(parent.createdBy)) audience.set(parent.createdBy, 'comment_reply')
  }
  if (comment.targetKind === 'task') {
    const [task] = await db`SELECT assignee_id AS "assigneeId" FROM tasks WHERE id = ${comment.targetId}`
    if (task?.assigneeId && !audience.has(task.assigneeId)) audience.set(task.assigneeId, 'task_comment')
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
  const [comment] = await db`SELECT target_kind AS "targetKind", target_id AS "targetId", created_by AS "createdBy" FROM planning_comments WHERE id = ${commentId} AND workspace_id = ${workspaceId}`
  if (!comment) throw new AppError('PLANNING_NOT_FOUND')
  await canReadTarget(db, workspaceId, comment.targetKind, comment.targetId, actorId)
  if (comment.createdBy !== actorId && !(await isPm(db, workspaceId, actorId))) throw new AppError('ROLE_NOT_ALLOWED')
  await db.begin(async (tx) => {
    await tx`UPDATE planning_comments SET resolved_at = now(), resolved_by = ${actorId} WHERE id = ${commentId} AND workspace_id = ${workspaceId}`
    await event(tx, workspaceId, actorId, comment.targetKind, comment.targetId, 'comment_resolved')
  })
}

export async function listPlanningEvents(db: SQL, workspaceId: string, actorId: string) {
  await requirePlanningPm(db, workspaceId, actorId)
  return db`SELECT id, actor_id AS "actorId", api_key_id AS "apiKeyId", target_kind AS "targetKind", target_id AS "targetId", action, created_at AS "createdAt" FROM planning_events WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC LIMIT 100`
}
