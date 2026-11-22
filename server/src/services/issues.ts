import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { isCalendarDate } from '@/lib/calendar-date'
import { findPlanningDocument } from '@/repositories/planning-documents.repository'
import { AppError } from '@/lib/errors/app-error'
import { type CursorKeys, cursorValues, encodeCursor, pageOf } from '@/lib/pagination'
import {
  allowedStatuses,
  ISSUE_PRIORITIES,
  ISSUE_TYPES,
  isBacklogItem,
  isPoints,
  type IssuePriority,
  type IssueRow,
  type IssueType,
  RANK_STEP,
} from '@/models/issue'
import { isFeaturePrefix, parseFeatureCode } from '@/models/feature-code'
import { isWorkRole } from '@/models/story'
import {
  allocateIssueNumber,
  findEpicByFeatureCode,
  findIssue,
  findIssueByNumber,
  insertIssue,
  insertStatusEvent,
  type IssuePatch,
  lastRank,
  listChildren,
  listIssues,
  listIssuesByNumber,
  nextFeatureNumber,
  updateIssueFields,
} from '@/repositories/issues.repository'
import { insertPlanningEvent } from '@/repositories/planning-events.repository'
import { keyOwner } from '@/repositories/project-settings.repository'
import { ensureAssigneeInProject } from '@/repositories/projects.repository'
import { findSprint, insertScopeEvent } from '@/repositories/sprints.repository'
import { type ProjectRoles, resolveProjectRoles } from '@/services/project-roles'

export interface IssueScope {
  workspaceId: string
  projectId: string
}

// A key id means the call comes from an AI agent key, which only drafts and moves its owner's own sub-tasks.
export interface Actor {
  userId: string
  apiKeyId?: string | null
}

export interface CreateIssueInput {
  type: IssueType
  title: string
  description?: string
  acceptanceCriteria?: string
  parentId?: string | null
  points?: number | null
  priority?: string
  role?: string | null
  assigneeId?: string | null
  dueDate?: string | null
  sourceDocumentId?: string | null
  sourceVersion?: number | null
  sourceSection?: string | null
  // Epics only: the product area of the feature code, such as AUTH. Without one, the project key is used.
  featurePrefix?: string | null
}

export interface UpdateIssueInput {
  title?: string
  description?: string
  acceptanceCriteria?: string
  status?: string
  points?: number | null
  priority?: string
  parentId?: string | null
  assigneeId?: string | null
  dueDate?: string | null
  // Epics only. A new prefix gives the epic the next free number for it.
  featurePrefix?: string
}

export const invalid = () => new AppError('ISSUE_INPUT_INVALID')
export const isAgent = (actor: Actor) => Boolean(actor.apiKeyId)
const isIssueType = (value: unknown): value is IssueType => (ISSUE_TYPES as readonly unknown[]).includes(value)
const hasDiscipline = (roles: ProjectRoles, discipline: string | null) => discipline !== null && roles.disciplines.includes(discipline)

function mayCreate(type: IssueType, roles: ProjectRoles, subtaskRole: string | null): boolean {
  if (roles.workspaceRole === 'viewer') return false
  if (type === 'bug') return true
  if (type === 'subtask') return roles.isTechLead || hasDiscipline(roles, subtaskRole)
  return roles.isPm || roles.isTechLead
}

export async function createIssue(db: SQL, scope: IssueScope, actor: Actor, input: CreateIssueInput): Promise<IssueRow> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  if (!isIssueType(input.type)) throw invalid()
  if (!mayCreate(input.type, roles, input.role ?? null)) throw new AppError('ROLE_NOT_ALLOWED')
  const id = await db.begin((tx) => insertNewIssue(tx, scope, actor, input))
  return (await findIssue(db, scope.projectId, id)) as IssueRow
}

// Checks and stores one new issue inside a transaction, and returns its id. The caller has already checked who may
// create it. A bulk creation calls this for every issue in one transaction, so it keeps all of them or none.
export async function insertNewIssue(tx: SQL, scope: IssueScope, actor: Actor, input: CreateIssueInput): Promise<string> {
  const fields = await validatedFields(tx, scope, input)
  const source = await sourceOf(tx, scope, input)
  const issueId = randomUUID()
  const rank = isBacklogItem(input.type) ? ((await lastRank(tx, scope.projectId)) ?? 0) + RANK_STEP : null
  await insertIssue(tx, {
    id: issueId,
    projectId: scope.projectId,
    number: await allocateIssueNumber(tx, scope.projectId),
    type: input.type,
    parentId: fields.parentId,
    title: fields.title,
    description: fields.description,
    acceptanceCriteria: fields.acceptanceCriteria,
    status: input.type === 'epic' ? null : input.type === 'story' ? 'draft' : 'todo',
    points: fields.points,
    priority: fields.priority,
    rank,
    role: input.type === 'subtask' ? fields.role : null,
    assigneeId: fields.assigneeId,
    dueDate: fields.dueDate,
    sourceDocumentId: source.documentId,
    sourceVersion: source.version,
    sourceSection: input.sourceSection ?? null,
    // Epics and stories wait for an approver to publish them. Agents only draft.
    published: !isAgent(actor) && (input.type === 'task' || input.type === 'bug' || input.type === 'subtask'),
    createdBy: actor.userId,
    featurePrefix: fields.featurePrefix,
  })
  await logEvent(tx, scope, actor, issueId, 'issue.created', { type: input.type })
  return issueId
}

// The document an issue comes from has to be one of this workspace, at a version it has. Without a version it is the current one.
async function sourceOf(db: SQL, scope: IssueScope, input: CreateIssueInput): Promise<{ documentId: string | null; version: number | null }> {
  if (!input.sourceDocumentId) return { documentId: null, version: input.sourceVersion ?? null }
  const document = await findPlanningDocument(db, scope.workspaceId, input.sourceDocumentId)
  if (!document) throw invalid()
  const version = input.sourceVersion ?? document.currentVersion
  if (version < 1 || version > document.currentVersion) throw invalid()
  return { documentId: document.id, version }
}

export async function getIssue(db: SQL, scope: IssueScope, actor: Actor, ref: string): Promise<IssueRow> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  return loadVisible(db, scope, actor, roles, ref)
}

export async function listProjectIssues(
  db: SQL,
  scope: IssueScope,
  actor: Actor,
  filter: { type?: IssueType; sprintId?: string | null; parentId?: string },
): Promise<IssueRow[]> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  return listIssues(db, scope.projectId, { ...filter, includeDrafts: roles.isApprover, viewerId: actor.userId })
}

// The issues of a project by number, a page at a time. The cursor is the number of the last issue of the page before.
export async function listIssuePage(
  db: SQL,
  scope: IssueScope,
  actor: Actor,
  filter: { type?: IssueType; sprintId?: string | null; parentId?: string; assigneeId?: string; participantId?: string },
  page: { limit: number; cursor: CursorKeys | null },
): Promise<{ items: IssueRow[]; nextCursor: string | null }> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const after = cursorValues(page.cursor, ['n'])
  if (after && !Number.isInteger(Number(after.n))) throw new AppError('PAGINATION_INVALID')
  const rows = await listIssuesByNumber(db, scope.projectId, {
    ...filter,
    includeDrafts: roles.isApprover,
    viewerId: actor.userId,
    limit: page.limit + 1,
    afterNumber: after ? Number(after.n) : null,
  })
  return pageOf(rows, page.limit, (row) => encodeCursor({ n: String(row.number) }))
}

export async function updateIssue(db: SQL, scope: IssueScope, actor: Actor, ref: string, patch: UpdateIssueInput): Promise<IssueRow> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const issue = await loadVisible(db, scope, actor, roles, ref)
  if (roles.workspaceRole === 'viewer') throw new AppError('ROLE_NOT_ALLOWED')
  const fields = await validatedPatch(db, scope, issue, patch)
  checkPermissions(issue, roles, actor, patch)
  if (patch.status !== undefined && patch.status !== issue.status) await checkStatusRules(db, issue, patch)

  await db.begin(async (tx) => {
    // A new prefix takes the next free number for it. The issue number lock keeps two renames from sharing one.
    const renamed = patch.featurePrefix !== undefined && patch.featurePrefix !== issue.featurePrefix
    const code = renamed ? { featurePrefix: patch.featurePrefix, featureNumber: await nextFeatureNumber(tx, scope.projectId, patch.featurePrefix as string) } : {}
    await updateIssueFields(tx, scope.projectId, issue.id, { ...fields, ...code })
    await recordPointsChange(tx, scope, actor, issue, patch.points)
    if (patch.status !== undefined && patch.status !== issue.status) {
      await recordStatus(tx, actor, issue.id, issue.status, patch.status)
      await startParentStory(tx, scope, actor, issue, patch.status)
    }
    await logEvent(tx, scope, actor, issue.id, 'issue.updated', { fields: Object.keys(patch) })
  })
  return (await findIssue(db, scope.projectId, issue.id)) as IssueRow
}

// An issue is found by its id or by its key, such as PARI-12. A draft is hidden from members who may not see it.
export async function loadVisible(db: SQL, scope: IssueScope, actor: Actor, roles: ProjectRoles, ref: string): Promise<IssueRow> {
  // An epic also opens by its feature code, such as AUTH-001. A code that names no epic is read as an issue key.
  const code = parseFeatureCode(ref)
  const epic = code ? await findEpicByFeatureCode(db, scope.projectId, code.prefix, code.number) : undefined
  const keyed = epic ? null : /^([A-Za-z]+)-(\d+)$/.exec(ref)
  const issue = epic ?? (keyed ? await findIssueByNumber(db, scope.projectId, Number(keyed[2])) : await findIssue(db, scope.projectId, ref))
  if (!issue) throw new AppError('ISSUE_NOT_FOUND')
  // A key the project had before still opens its issues.
  if (keyed && issue.key.toLowerCase() !== ref.toLowerCase() && (await keyOwner(db, scope.workspaceId, keyed[1].toUpperCase())) !== scope.projectId) {
    throw new AppError('ISSUE_NOT_FOUND')
  }
  if (!issue.publishedAt && !roles.isApprover && issue.createdBy !== actor.userId) throw new AppError('ISSUE_NOT_FOUND')
  return issue
}

async function validatedFields(db: SQL, scope: IssueScope, input: CreateIssueInput) {
  const title = text(input.title, 1, 180)
  const description = text(input.description ?? '', 0, 8000)
  const acceptanceCriteria = text(input.acceptanceCriteria ?? '', 0, 8000)
  const priority = priorityOf(input.priority ?? 'medium')
  const points = input.points ?? null
  if (points !== null && (!isBacklogItem(input.type) || !isPoints(points))) throw invalid()
  const dueDate = dueDateOf(input.dueDate ?? null)
  const assigneeId = input.assigneeId ?? null
  if (!(await ensureAssigneeInProject(db, scope.workspaceId, scope.projectId, assigneeId))) throw invalid()

  const role = input.role ?? null
  if (input.type === 'subtask' ? !isWorkRole(role) : role !== null) throw invalid()
  const parentId = input.parentId ?? null
  await checkParent(db, scope, input.type, parentId)
  const featurePrefix = input.featurePrefix ?? null
  if (featurePrefix !== null && (input.type !== 'epic' || !isFeaturePrefix(featurePrefix))) throw invalid()
  return { title, description, acceptanceCriteria, priority, points, dueDate, assigneeId, role, parentId, featurePrefix }
}

// Story, task, and bug hang under an epic or stand alone. A sub-task needs a story, task, or bug. An epic has no parent.
async function checkParent(db: SQL, scope: IssueScope, type: IssueType, parentId: string | null): Promise<void> {
  if (type === 'epic' ? parentId !== null : type === 'subtask' && parentId === null) throw invalid()
  if (parentId === null) return
  const parent = await findIssue(db, scope.projectId, parentId)
  const parentTypes: IssueType[] = type === 'subtask' ? ['story', 'task', 'bug'] : ['epic']
  if (!parent || !parentTypes.includes(parent.type)) throw invalid()
}

async function validatedPatch(db: SQL, scope: IssueScope, issue: IssueRow, patch: UpdateIssueInput): Promise<IssuePatch> {
  if (patch.status !== undefined && !(allowedStatuses(issue.type) as readonly string[]).includes(patch.status)) {
    throw new AppError('ISSUE_STATUS_NOT_ALLOWED')
  }
  if (patch.points !== undefined && patch.points !== null && (!isBacklogItem(issue.type) || !isPoints(patch.points))) throw invalid()
  if (patch.points === null && !isBacklogItem(issue.type)) throw invalid()
  if (patch.parentId !== undefined) {
    if (!isBacklogItem(issue.type)) throw invalid()
    await checkParent(db, scope, issue.type, patch.parentId)
  }
  if (patch.assigneeId && !(await ensureAssigneeInProject(db, scope.workspaceId, scope.projectId, patch.assigneeId))) throw invalid()
  if (patch.featurePrefix !== undefined && (issue.type !== 'epic' || !isFeaturePrefix(patch.featurePrefix))) throw invalid()
  return {
    title: patch.title === undefined ? undefined : text(patch.title, 1, 180),
    description: patch.description === undefined ? undefined : text(patch.description, 0, 8000),
    acceptanceCriteria: patch.acceptanceCriteria === undefined ? undefined : text(patch.acceptanceCriteria, 0, 8000),
    status: patch.status,
    points: patch.points,
    priority: patch.priority === undefined ? undefined : priorityOf(patch.priority),
    parentId: patch.parentId,
    assigneeId: patch.assigneeId,
    dueDate: patch.dueDate === undefined ? undefined : dueDateOf(patch.dueDate),
  }
}

function checkPermissions(issue: IssueRow, roles: ProjectRoles, actor: Actor, patch: UpdateIssueInput): void {
  const mine = issue.assigneeId === actor.userId
  const matchingSubtask = issue.type === 'subtask' && hasDiscipline(roles, issue.role)
  const editsContent = roles.isApprover || (issue.type === 'bug' && issue.createdBy === actor.userId) || matchingSubtask

  // The PM owns the product areas, so only the PM renames the code of a feature.
  if (patch.featurePrefix !== undefined && (!roles.isPm || isAgent(actor))) throw new AppError('ROLE_NOT_ALLOWED')
  if (patch.status !== undefined) {
    // An agent key moves only a sub-task assigned to its owner.
    if (isAgent(actor) && !(issue.type === 'subtask' && mine)) throw new AppError('ISSUE_AGENT_FORBIDDEN')
    const qa = hasDiscipline(roles, 'qa')
    const allowed = issue.type === 'story' ? (roles.isApprover || qa) && (patch.status !== 'done' || roles.isPm || qa) : roles.isApprover || mine || matchingSubtask
    if (!allowed) throw new AppError('ROLE_NOT_ALLOWED')
  }
  const content = [patch.title, patch.description, patch.acceptanceCriteria, patch.priority, patch.parentId, patch.dueDate]
  if (content.some((value) => value !== undefined) && !editsContent) throw new AppError('ROLE_NOT_ALLOWED')
  // A member may take an issue for themselves or hand their own back.
  const selfAssign = patch.assigneeId === actor.userId || (patch.assigneeId === null && mine)
  if (patch.assigneeId !== undefined && !editsContent && !selfAssign) throw new AppError('ROLE_NOT_ALLOWED')
}

async function checkStatusRules(db: SQL, issue: IssueRow, patch: UpdateIssueInput): Promise<void> {
  if (issue.type === 'story' && patch.status === 'ready') {
    const criteria = patch.acceptanceCriteria ?? issue.acceptanceCriteria
    if (criteria.trim() === '' || !issue.designApprovedAt) throw new AppError('ISSUE_NOT_READY')
  }
  if (patch.status === 'done' && issue.type !== 'subtask') {
    const open = (await listChildren(db, issue.id)).some((child) => child.type === 'subtask' && child.status !== 'done')
    if (open) throw new AppError('ISSUE_SUBTASKS_OPEN')
  }
}

// A new estimate on an item in an open sprint is scope history. The sprint report reads it.
async function recordPointsChange(tx: SQL, scope: IssueScope, actor: Actor, issue: IssueRow, next: number | null | undefined): Promise<void> {
  if (next === undefined || next === issue.points || !issue.sprintId) return
  const sprint = await findSprint(tx, scope.projectId, issue.sprintId)
  if (!sprint || sprint.status === 'closed') return
  await insertScopeEvent(tx, {
    id: randomUUID(),
    sprintId: sprint.id,
    issueId: issue.id,
    action: 'points_changed',
    pointsBefore: issue.points,
    pointsAfter: next,
    afterStart: sprint.status === 'active',
    overrideReason: null,
    actorId: actor.userId,
  })
}

// The first sub-task to leave todo moves a Ready story to In Progress.
async function startParentStory(tx: SQL, scope: IssueScope, actor: Actor, issue: IssueRow, nextStatus: string): Promise<void> {
  if (issue.type !== 'subtask' || issue.status !== 'todo' || nextStatus === 'todo' || !issue.parentId) return
  const parent = await findIssue(tx, scope.projectId, issue.parentId)
  if (parent?.type !== 'story' || parent.status !== 'ready') return
  await updateIssueFields(tx, scope.projectId, parent.id, { status: 'in_progress' })
  await recordStatus(tx, actor, parent.id, 'ready', 'in_progress')
}

const recordStatus = (tx: SQL, actor: Actor, issueId: string, from: string | null, to: string) =>
  insertStatusEvent(tx, { id: randomUUID(), issueId, fromStatus: from, toStatus: to, actorId: actor.userId, apiKeyId: actor.apiKeyId ?? null })

export const logEvent = (tx: SQL, scope: IssueScope, actor: Actor, issueId: string, action: string, details: Record<string, unknown>) =>
  insertPlanningEvent(tx, { workspaceId: scope.workspaceId, actorId: actor.userId, apiKeyId: actor.apiKeyId ?? null, targetKind: 'issue', targetId: issueId, action, details })

function text(value: unknown, min: number, max: number): string {
  if (typeof value !== 'string') throw invalid()
  const trimmed = value.trim()
  if (trimmed.length < min || trimmed.length > max) throw invalid()
  return trimmed
}

function priorityOf(value: unknown): IssuePriority {
  if (!(ISSUE_PRIORITIES as readonly unknown[]).includes(value)) throw invalid()
  return value as IssuePriority
}

function dueDateOf(value: string | null): string | null {
  if (value === null) return null
  if (!isCalendarDate(value)) throw invalid()
  return value
}
