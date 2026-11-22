import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import {
  blockedBy,
  checkSections,
  type DocumentState,
  EPIC_DOCUMENT_OWNER,
  EPIC_DOCUMENT_SOURCE,
  type EpicDocumentKind,
  type EpicDocumentSections,
  isEpicDocumentKind,
  normalizeSections,
  parseSections,
  SECTION_MAX_LENGTH,
} from '@/models/epic-document'
import type { IssueRow } from '@/models/issue'
import {
  bumpPlanningDocumentVersion,
  type EpicDocumentRow,
  findEpicDocument,
  insertEpicDocument,
  insertPlanningDocumentVersion,
  listEpicDocumentRows,
  updatePlanningDocumentStatus,
} from '@/repositories/planning-documents.repository'
import { type Actor, invalid, isAgent, type IssueScope, loadVisible, logEvent } from '@/services/issues'
import { type ProjectRoles, resolveProjectRoles } from '@/services/project-roles'

export interface EpicDocument {
  id: string
  epicId: string
  kind: EpicDocumentKind
  title: string
  status: string
  version: number
  sections: EpicDocumentSections
  sourceDocumentId: string | null
  sourceVersion: number | null
  stale: boolean
  approvedBy: string | null
  approvedAt: Date | null
  createdBy: string
  updatedAt: Date
}

export interface EpicDocuments {
  documents: EpicDocument[]
  // For each kind: why it cannot be drafted yet, or null when it can.
  blocked: Record<EpicDocumentKind, string | null>
}

const toDocument = (row: EpicDocumentRow): EpicDocument => ({
  id: row.id,
  epicId: row.epicId,
  kind: row.kind as EpicDocumentKind,
  title: row.title,
  status: row.status,
  version: Number(row.currentVersion),
  sections: parseSections(row.content),
  sourceDocumentId: row.sourceDocumentId,
  sourceVersion: row.sourceVersion === null ? null : Number(row.sourceVersion),
  stale: row.stale,
  approvedBy: row.approvedBy,
  approvedAt: row.approvedAt,
  createdBy: row.createdBy,
  updatedAt: row.updatedAt,
})

async function loadEpic(db: SQL, scope: IssueScope, actor: Actor, ref: string): Promise<{ epic: IssueRow; roles: ProjectRoles }> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const epic = await loadVisible(db, scope, actor, roles, ref)
  if (epic.type !== 'epic') throw new AppError('ISSUE_NOT_FOUND')
  return { epic, roles }
}

const stateOf = (rows: EpicDocumentRow[]): Partial<Record<EpicDocumentKind, DocumentState>> =>
  Object.fromEntries(rows.map((row) => [row.kind, { status: row.status, stale: row.stale }]))

// The PM writes the spec and the tech lead writes the design and the contract. The workspace owner may do both.
// An agent key works for the person who owns it, so it may draft what that person may draft.
function mayWrite(kind: EpicDocumentKind, roles: ProjectRoles): boolean {
  if (roles.workspaceRole === 'viewer') return false
  return EPIC_DOCUMENT_OWNER[kind] === 'pm' ? roles.isPm : roles.isTechLead
}

function sectionsOf(kind: EpicDocumentKind, input: unknown): EpicDocumentSections {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid()
  const raw = input as Record<string, unknown>
  const { missing, unknown } = checkSections(kind, raw)
  if (unknown.length > 0) throw new AppError('ISSUE_INPUT_INVALID', { details: { unknownSections: unknown } })
  if (Object.values(raw).some((value) => typeof value === 'string' && value.length > SECTION_MAX_LENGTH)) throw invalid()
  if (missing.length > 0) throw new AppError('EPIC_DOCUMENT_INCOMPLETE', { details: { missing } })
  return normalizeSections(kind, raw)
}

function titleOf(value: unknown, fallback: string): string {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || value.trim() === '' || value.trim().length > 180) throw invalid()
  return value.trim()
}

// Drafts are read by the PM and the tech lead, and by whoever made them. Every member reads an approved document.
const visible = (row: EpicDocumentRow, roles: ProjectRoles, actor: Actor) => row.status === 'approved' || roles.isApprover || row.createdBy === actor.userId

export async function listEpicDocuments(db: SQL, scope: IssueScope, actor: Actor, epicRef: string): Promise<EpicDocuments> {
  const { epic, roles } = await loadEpic(db, scope, actor, epicRef)
  const rows = await listEpicDocumentRows(db, epic.id)
  const state = stateOf(rows)
  return {
    documents: rows.filter((row) => visible(row, roles, actor)).map(toDocument),
    blocked: { spec: blockedBy('spec', state), design: blockedBy('design', state), contract: blockedBy('contract', state) },
  }
}

export async function getEpicDocument(db: SQL, scope: IssueScope, actor: Actor, epicRef: string, documentId: string): Promise<EpicDocument> {
  const { epic, roles } = await loadEpic(db, scope, actor, epicRef)
  const row = await findEpicDocument(db, epic.id, documentId)
  if (!row || !visible(row, roles, actor)) throw new AppError('PLANNING_NOT_FOUND')
  return toDocument(row)
}

export async function createEpicDocument(
  db: SQL,
  scope: IssueScope,
  actor: Actor,
  epicRef: string,
  input: { kind?: unknown; title?: unknown; sections?: unknown },
): Promise<EpicDocument> {
  if (!isEpicDocumentKind(input.kind)) throw invalid()
  const kind = input.kind
  const { epic, roles } = await loadEpic(db, scope, actor, epicRef)
  if (!mayWrite(kind, roles)) throw new AppError('ROLE_NOT_ALLOWED')
  const sections = sectionsOf(kind, input.sections)
  const title = titleOf(input.title, `${epic.featureCode} ${kind}`)

  const id = randomUUID()
  await db.begin(async (tx) => {
    const rows = await listEpicDocumentRows(tx, epic.id)
    if (rows.some((row) => row.kind === kind)) throw new AppError('PLANNING_CONFLICT')
    const needs = blockedBy(kind, stateOf(rows))
    if (needs) throw new AppError('EPIC_DOCUMENT_BLOCKED', { details: { needs } })
    const source = sourceRow(kind, rows)
    await insertEpicDocument(tx, { id, workspaceId: scope.workspaceId, projectId: scope.projectId, epicId: epic.id, kind, title, sourceDocumentId: source?.id ?? null, createdBy: actor.userId })
    await insertPlanningDocumentVersion(tx, { documentId: id, version: 1, content: JSON.stringify(sections), sourceVersion: source ? Number(source.currentVersion) : null, createdBy: actor.userId })
    await logEvent(tx, scope, actor, epic.id, 'epic_document.created', { kind, documentId: id })
  })
  return toDocument((await findEpicDocument(db, epic.id, id)) as EpicDocumentRow)
}

const sourceRow = (kind: EpicDocumentKind, rows: EpicDocumentRow[]) => {
  const sourceKind = EPIC_DOCUMENT_SOURCE[kind]
  return sourceKind ? rows.find((row) => row.kind === sourceKind) : undefined
}

// A new version goes back to draft and needs approval again. A design or contract revised now is built on the current
// version of its source, which is how a stale document catches up.
export async function reviseEpicDocument(
  db: SQL,
  scope: IssueScope,
  actor: Actor,
  epicRef: string,
  documentId: string,
  input: { expectedVersion?: unknown; title?: unknown; sections?: unknown },
): Promise<EpicDocument> {
  const { epic, roles } = await loadEpic(db, scope, actor, epicRef)
  const current = await findEpicDocument(db, epic.id, documentId)
  if (!current || current.status === 'superseded' || current.status === 'discarded') throw new AppError('PLANNING_NOT_FOUND')
  const kind = current.kind as EpicDocumentKind
  if (!mayWrite(kind, roles)) throw new AppError('ROLE_NOT_ALLOWED')
  if (!Number.isInteger(input.expectedVersion)) throw invalid()
  const sections = sectionsOf(kind, input.sections)
  const title = titleOf(input.title, current.title)

  await db.begin(async (tx) => {
    const rows = await listEpicDocumentRows(tx, epic.id)
    const needs = blockedBy(kind, stateOf(rows))
    if (needs) throw new AppError('EPIC_DOCUMENT_BLOCKED', { details: { needs } })
    const source = sourceRow(kind, rows)
    const version = await bumpPlanningDocumentVersion(tx, { workspaceId: scope.workspaceId, documentId, expectedVersion: input.expectedVersion as number, title, status: 'draft' })
    if (version === undefined) throw new AppError('PLANNING_CONFLICT')
    await insertPlanningDocumentVersion(tx, { documentId, version, content: JSON.stringify(sections), sourceVersion: source ? Number(source.currentVersion) : null, createdBy: actor.userId })
    await logEvent(tx, scope, actor, epic.id, 'epic_document.revised', { kind, documentId, version })
  })
  return toDocument((await findEpicDocument(db, epic.id, documentId)) as EpicDocumentRow)
}

// Only a person approves, never an agent key. The PM approves the spec, the tech lead the design and the contract.
// A document built on an old version of its source, or whose source is no longer approved, waits.
export async function approveEpicDocument(db: SQL, scope: IssueScope, actor: Actor, epicRef: string, documentId: string): Promise<EpicDocument> {
  if (isAgent(actor)) throw new AppError('ISSUE_AGENT_FORBIDDEN')
  return moveStatus(db, scope, actor, epicRef, documentId, 'approved')
}

// A draft that should not go on is discarded, which makes room for a new one of the same kind.
export async function discardEpicDocument(db: SQL, scope: IssueScope, actor: Actor, epicRef: string, documentId: string): Promise<EpicDocument> {
  if (isAgent(actor)) throw new AppError('ISSUE_AGENT_FORBIDDEN')
  return moveStatus(db, scope, actor, epicRef, documentId, 'discarded')
}

async function moveStatus(db: SQL, scope: IssueScope, actor: Actor, epicRef: string, documentId: string, status: 'approved' | 'discarded'): Promise<EpicDocument> {
  const { epic, roles } = await loadEpic(db, scope, actor, epicRef)
  const current = await findEpicDocument(db, epic.id, documentId)
  if (!current) throw new AppError('PLANNING_NOT_FOUND')
  const kind = current.kind as EpicDocumentKind
  if (!mayWrite(kind, roles)) throw new AppError('ROLE_NOT_ALLOWED')
  if (current.status !== 'draft') throw new AppError('PLANNING_CONFLICT')

  await db.begin(async (tx) => {
    if (status === 'approved') {
      const needs = blockedBy(kind, stateOf(await listEpicDocumentRows(tx, epic.id)))
      if (needs) throw new AppError('EPIC_DOCUMENT_BLOCKED', { details: { needs } })
      if (current.stale) throw new AppError('EPIC_DOCUMENT_BLOCKED', { details: { needs: `${EPIC_DOCUMENT_SOURCE[kind]}_current` } })
    }
    const approved = status === 'approved'
    const moved = await updatePlanningDocumentStatus(tx, {
      workspaceId: scope.workspaceId,
      documentId,
      from: current.status,
      version: Number(current.currentVersion),
      status,
      approvedBy: approved ? actor.userId : null,
      approvedAt: approved ? new Date() : null,
    })
    if (!moved) throw new AppError('PLANNING_CONFLICT')
    await logEvent(tx, scope, actor, epic.id, `epic_document.${status}`, { kind, documentId, version: Number(current.currentVersion) })
  })
  return toDocument((await findEpicDocument(db, epic.id, documentId)) as EpicDocumentRow)
}
