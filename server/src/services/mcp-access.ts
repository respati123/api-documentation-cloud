import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { isMcpRole, isReadTool, PLANNING_TOOLS, toolsForRoles, type McpPrincipal, type McpTool } from '@/models/mcp'
import type { AppName } from '@/repositories/app-links.repository'
import type { AppsClient } from '@/services/apps-client'
import { appRolesOf, workspaceAppAllowed } from '@/services/app-access'
import { appActorOf } from '@/services/app-integrations'
import type { TaskStatus } from '@/models/project'
import { findMcpKeyAuth, markGuideRead, touchMcpKey } from '@/repositories/mcp-keys.repository'
import { listUserDisciplines } from '@/repositories/planning-audience.repository'
import { GUIDE_VERSION, guideFor } from '@/services/mcp-guides'
import { findRole, listUserWorkspaces, listWorkspaceTeam } from '@/repositories/memberships.repository'
import { findAssignedTask, findTaskInWorkspace, listAssignedTasks, listProjects, listTasks, listUserRolesByWorkspace } from '@/repositories/projects.repository'
import { addTaskSubtask, getTaskSubtasks, setTaskSubtaskDone } from '@/services/projects'
import { addStoryTestCase, attachStoryDesign, getStoryDetails, linkStoryContract, linkStoryDataModel, updateStoryDetails } from '@/services/stories'
import { listParticipatingStories, isStoryParticipant } from '@/repositories/planning.repository'
import { mcpKeyHash } from '@/services/mcp-keys'
import { decodeCursor } from '@/lib/pagination'
import { parseInput } from '@/lib/parse-input'
import { createIssueBody } from '@/models/issue-input'
import { listChecklist, listLinks, setChecklistItemDone } from '@/services/issue-details'
import { readBacklog } from '@/services/issue-backlog'
import { insertPlanningEvent } from '@/repositories/planning-events.repository'
import { createIssue, getIssue, updateIssue } from '@/services/issues'
import { searchCollectionRequests } from '@/services/collection-search'
import { listNotificationsPage } from '@/services/notifications'
import { countUnreadNotifications, listUnreadNotifications, markAllNotificationsRead, markNotificationRead } from '@/repositories/notifications.repository'
import { findHeadSnapshot } from '@/repositories/stories.repository'
import { addPlanningComment, listPlanningComments, createPlanningDocument, createPlanningItem, createPlanningTaskDraft, getPlanningDocument, listPlanningDocuments, listPlanningItems, listPlanningTasks, type PlanningVia, type TargetKind } from '@/services/planning'

const statuses: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done']

// The key only proves who is calling. The tools come from the member's roles: the union over every workspace here,
// for tools/list and the playbook, and the roles of the named workspace again on every call.
export async function authenticateMcpKey(db: SQL, value: string | undefined): Promise<McpPrincipal> {
  if (!value?.startsWith('apm_')) throw new AppError('MCP_KEY_INVALID')
  const key = await findMcpKeyAuth(db, mcpKeyHash(value))
  if (!key) throw new AppError('MCP_KEY_INVALID')
  await touchMcpKey(db, key.keyId)
  const allRoles = [...new Set((await listUserRolesByWorkspace(db, key.userId)).flatMap((workspace) => workspace.roles))]
  return { ...key, roles: allRoles.filter(isMcpRole), tools: toolsForRoles(allRoles) }
}

const GUIDE_FRESH_MS = 12 * 60 * 60 * 1000

// A key may write once it has read the current playbook within the last twelve hours.
export function guideIsFresh(principal: McpPrincipal, now = Date.now()): boolean {
  return principal.guideVersion === GUIDE_VERSION && Boolean(principal.guideReadAt) && now - new Date(principal.guideReadAt as Date).getTime() < GUIDE_FRESH_MS
}

export async function readMcpGuide(db: SQL, principal: McpPrincipal) {
  await markGuideRead(db, principal.keyId, GUIDE_VERSION)
  return { version: GUIDE_VERSION, roles: principal.roles, guide: guideFor(principal.roles) }
}

function filled(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function requireTool(principal: McpPrincipal, tool: McpTool) {
  if (!principal.tools.includes(tool)) throw new AppError('MCP_PERMISSION_DENIED')
}

// The roles found for a workspace during this request, so a call reads them once.
const workspaceRoles = new WeakMap<McpPrincipal, Map<string, string[]>>()

// Every tool except workspaces_list names a workspace. The member must belong to it, one of the member's roles
// there must grant the tool, and a viewer only reads, at the time of the call.
async function requireWorkspace(db: SQL, principal: McpPrincipal, tool: McpTool, workspaceId: unknown): Promise<string> {
  requireTool(principal, tool)
  if (typeof workspaceId !== 'string') throw new AppError('WORKSPACE_NOT_FOUND')
  const membership = await findRole(db, workspaceId, principal.userId)
  if (!membership) throw new AppError('WORKSPACE_NOT_FOUND')
  if (membership === 'viewer' && !isReadTool(tool)) throw new AppError('MCP_PERMISSION_DENIED')
  const roles = await listUserDisciplines(db, workspaceId, principal.userId)
  if (!toolsForRoles(roles).includes(tool)) throw new AppError('MCP_PERMISSION_DENIED')
  const known = workspaceRoles.get(principal) ?? new Map<string, string[]>()
  known.set(workspaceId, roles)
  workspaceRoles.set(principal, known)
  return workspaceId
}

// A member whose roles in the workspace hold planning tools works on planning there as a PM.
function via(principal: McpPrincipal, workspaceId: string): PlanningVia {
  const roles = workspaceRoles.get(principal)?.get(workspaceId) ?? []
  return { apiKeyId: principal.keyId, planning: toolsForRoles(roles).some((tool) => PLANNING_TOOLS.includes(tool)), roles }
}

async function projectIdsOf(db: SQL, workspaceId: string): Promise<string[]> {
  return (await listProjects(db, workspaceId)).map((project) => project.id)
}

export async function listMcpWorkspaces(db: SQL, principal: McpPrincipal) {
  requireTool(principal, 'workspaces_list')
  return listUserWorkspaces(db, principal.userId)
}

export async function listMcpAssignedTasks(db: SQL, principal: McpPrincipal, workspaceId: unknown) {
  const id = await requireWorkspace(db, principal, 'tasks_list_assigned', workspaceId)
  return listAssignedTasks(db, await projectIdsOf(db, id), principal.userId)
}

export async function getMcpAssignedTask(db: SQL, principal: McpPrincipal, workspaceId: unknown, taskId: unknown) {
  const id = await requireWorkspace(db, principal, 'tasks_get_assigned', workspaceId)
  const task = typeof taskId === 'string' ? await findAssignedTask(db, taskId, await projectIdsOf(db, id), principal.userId) : undefined
  if (!task) throw new AppError('TASK_NOT_FOUND')
  return task
}

export async function changeMcpAssignedTaskStatus(db: SQL, principal: McpPrincipal, workspaceId: unknown, taskId: unknown, status: unknown) {
  const id = await requireWorkspace(db, principal, 'tasks_update_assigned_status', workspaceId)
  if (typeof status !== 'string' || !statuses.includes(status as TaskStatus)) throw new AppError('TASK_INPUT_INVALID')
  const current = typeof taskId === 'string' ? await findTaskInWorkspace(db, taskId, id) : undefined
  if (current?.locked && status !== 'backlog' && status !== current.status) throw new AppError('TASK_LOCKED')
  const assigned = typeof taskId === 'string' ? await findAssignedTask(db, taskId, await projectIdsOf(db, id), principal.userId) : undefined
  if (!assigned) throw new AppError('TASK_NOT_FOUND')
  // The issue service holds an agent key to its own sub-tasks, and runs the roll-up and the open sub-task checks.
  const scope = await issueScope(db, id)
  await updateIssue(db, scope, asAgent(principal), assigned.id, { status: status === 'backlog' ? 'todo' : status })
  const task = await findAssignedTask(db, assigned.id, await projectIdsOf(db, id), principal.userId)
  if (!task) throw new AppError('TASK_NOT_FOUND')
  // The issue service wrote the status event. This is the line the activity panel of the task shows.
  if (task.status !== current?.status) {
    await insertPlanningEvent(db, { workspaceId: id, actorId: principal.userId, apiKeyId: principal.keyId, targetKind: 'task', targetId: task.id, action: `status:${task.status}` })
  }
  return task
}

type CommentInput = { body: unknown; parentId?: unknown }

const handleOf = (email: string) => email.split('@')[0]
const MENTION = /(?:^|\s)@([\w.+-]+)/g

// "@handle" in the body names a member by the part of their email before the @, as in the web app.
// A handle that matches no member is reported back, so the agent can correct it.
async function postMcpComment(db: SQL, principal: McpPrincipal, workspaceId: string, targetKind: TargetKind, targetId: string, input: CommentInput) {
  const handles = typeof input.body === 'string' ? [...new Set([...input.body.matchAll(MENTION)].map((match) => match[1].replace(/[.]+$/, '')))] : []
  const team = handles.length > 0 ? await listWorkspaceTeam(db, workspaceId) : []
  const byHandle = (handle: string) => team.filter((member) => handleOf(member.email).toLowerCase() === handle.toLowerCase())
  const mentioned = handles.filter((handle) => byHandle(handle).length > 0)
  const mentionIds = mentioned.flatMap((handle) => byHandle(handle).map((member) => member.id)).slice(0, 20)
  const comment = await addPlanningComment(db, workspaceId, principal.userId, targetKind, targetId, { body: input.body, parentId: input.parentId, mentionIds }, via(principal, workspaceId))
  return { ...comment, mentioned, unknownMentions: handles.filter((handle) => !mentioned.includes(handle)) }
}

export async function listMcpTeamMembers(db: SQL, principal: McpPrincipal, workspaceId: unknown) {
  const id = await requireWorkspace(db, principal, 'team_members_list', workspaceId)
  return (await listWorkspaceTeam(db, id)).map((member) => ({ id: member.id, handle: handleOf(member.email), email: member.email, workspaceRole: member.role, projectRoles: member.disciplines }))
}

type CommentRow = { id: string; parentId: string | null; body: string; isDecision: boolean; resolvedAt: Date | null; authorEmail: string; createdAt: Date }

// Comments of one document, epic, story, or task, as threads: each top-level comment with its replies in order.
export async function readMcpDiscussion(db: SQL, principal: McpPrincipal, workspaceId: unknown, input: { targetKind: unknown; targetId: unknown }) {
  const id = await requireWorkspace(db, principal, 'discussion_read', workspaceId)
  if (!['document', 'epic', 'story', 'task'].includes(String(input.targetKind)) || typeof input.targetId !== 'string') throw new AppError('PLANNING_INPUT_INVALID')
  const rows = (await listPlanningComments(db, id, principal.userId, input.targetKind as TargetKind, input.targetId, via(principal, id))) as unknown as CommentRow[]
  const view = (row: CommentRow) => ({ id: row.id, author: handleOf(row.authorEmail), body: row.body, isDecision: row.isDecision, resolved: row.resolvedAt !== null, createdAt: row.createdAt })
  return rows.filter((row) => !row.parentId).map((row) => ({ ...view(row), replies: rows.filter((reply) => reply.parentId === row.id).map(view) }))
}

export async function commentMcpAssignedTask(db: SQL, principal: McpPrincipal, workspaceId: unknown, taskId: unknown, input: CommentInput) {
  const id = await requireWorkspace(db, principal, 'tasks_comment_assigned', workspaceId)
  const task = typeof taskId === 'string' ? await findAssignedTask(db, taskId, await projectIdsOf(db, id), principal.userId) : undefined
  if (!task) throw new AppError('TASK_NOT_FOUND')
  return postMcpComment(db, principal, id, 'task', task.id, input)
}

export async function listMcpParticipatingStories(db: SQL, principal: McpPrincipal, workspaceId: unknown) {
  const id = await requireWorkspace(db, principal, 'stories_list_participating', workspaceId)
  return listParticipatingStories(db, id, principal.userId)
}

async function requireParticipatingStory(db: SQL, workspaceId: string, userId: string, storyId: unknown): Promise<string> {
  if (typeof storyId !== 'string' || !(await isStoryParticipant(db, workspaceId, storyId, userId))) throw new AppError('PLANNING_NOT_FOUND')
  return storyId
}

export async function commentMcpParticipatingStory(db: SQL, principal: McpPrincipal, workspaceId: unknown, storyId: unknown, input: CommentInput) {
  const id = await requireWorkspace(db, principal, 'stories_comment_participating', workspaceId)
  const story = await requireParticipatingStory(db, id, principal.userId, storyId)
  return postMcpComment(db, principal, id, 'story', story, input)
}

// Read-only views for every member: published work, and the documents the key's role may read.
export async function listMcpProjectItems(db: SQL, principal: McpPrincipal, workspaceId: unknown) {
  const id = await requireWorkspace(db, principal, 'project_items_list', workspaceId)
  return listPlanningItems(db, id, principal.userId, via(principal, id))
}

export async function listMcpProjectTasks(db: SQL, principal: McpPrincipal, workspaceId: unknown) {
  const id = await requireWorkspace(db, principal, 'project_tasks_list', workspaceId)
  return listPlanningTasks(db, id, principal.userId, via(principal, id))
}

export async function listMcpDocuments(db: SQL, principal: McpPrincipal, workspaceId: unknown) {
  const id = await requireWorkspace(db, principal, 'documents_list', workspaceId)
  return listPlanningDocuments(db, id, principal.userId, via(principal, id))
}

export async function readMcpReadableDocument(db: SQL, principal: McpPrincipal, workspaceId: unknown, documentId: unknown) {
  const id = await requireWorkspace(db, principal, 'documents_read', workspaceId)
  if (typeof documentId !== 'string') throw new AppError('PLANNING_INPUT_INVALID')
  return getPlanningDocument(db, id, documentId, principal.userId, via(principal, id))
}

export async function listMcpPlanning(db: SQL, principal: McpPrincipal, workspaceId: unknown) {
  const id = await requireWorkspace(db, principal, 'planning_list', workspaceId)
  const grant = via(principal, id)
  return { documents: await listPlanningDocuments(db, id, principal.userId, grant), items: await listPlanningItems(db, id, principal.userId, grant), tasks: await listPlanningTasks(db, id, principal.userId, grant) }
}

// The playbook asks for ten level-2 sections; fewer than six means the template was not followed.
export async function draftMcpPrd(db: SQL, principal: McpPrincipal, workspaceId: unknown, input: { title: unknown; content: unknown; sourceDocumentId: unknown }) {
  const id = await requireWorkspace(db, principal, 'planning_draft_prd', workspaceId)
  if (typeof input.content !== 'string' || (input.content.match(/^##\s+\S/gm) ?? []).length < 6) throw new AppError('MCP_DRAFT_INCOMPLETE')
  return createPlanningDocument(db, id, principal.userId, { kind: 'prd', ...input }, via(principal, id))
}

// The agent hands over the BRD a person gave it, as text. It is stored like a file uploaded in the web app.
export async function uploadMcpBrd(db: SQL, principal: McpPrincipal, workspaceId: unknown, input: { title: unknown; content: unknown; fileName?: unknown }) {
  const id = await requireWorkspace(db, principal, 'planning_upload_brd', workspaceId)
  if (input.fileName === undefined) return createPlanningDocument(db, id, principal.userId, { kind: 'brd', title: input.title, content: input.content }, via(principal, id))
  const fileName = typeof input.fileName === 'string' ? input.fileName.trim() : ''
  const lower = fileName.toLowerCase()
  if ((!lower.endsWith('.md') && !lower.endsWith('.txt')) || typeof input.content !== 'string') throw new AppError('PLANNING_INPUT_INVALID')
  const file = { fileName, mimeType: lower.endsWith('.md') ? 'text/markdown' : 'text/plain', fileBytes: new TextEncoder().encode(input.content) }
  return createPlanningDocument(db, id, principal.userId, { kind: 'brd', title: input.title, content: input.content, ...file }, via(principal, id))
}

export async function draftMcpItem(db: SQL, principal: McpPrincipal, workspaceId: unknown, input: { kind: unknown; parentId?: unknown; title: unknown; description?: unknown; acceptanceCriteria?: unknown; sourceDocumentId: unknown; sourceSection?: unknown; participantIds?: unknown }) {
  const id = await requireWorkspace(db, principal, 'planning_draft_item', workspaceId)
  if (!filled(input.sourceSection) || (input.kind === 'story' && !filled(input.acceptanceCriteria))) throw new AppError('MCP_DRAFT_INCOMPLETE')
  return createPlanningItem(db, id, principal.userId, input, via(principal, id))
}

export async function draftMcpTask(db: SQL, principal: McpPrincipal, workspaceId: unknown, input: { storyId: unknown; title: unknown; description?: unknown; assigneeId?: unknown; priority?: unknown; role?: unknown }) {
  const id = await requireWorkspace(db, principal, 'planning_draft_task', workspaceId)
  if (!filled(input.role)) throw new AppError('MCP_DRAFT_INCOMPLETE')
  return createPlanningTaskDraft(db, id, principal.userId, input, via(principal, id))
}

export async function commentMcpPlanning(db: SQL, principal: McpPrincipal, workspaceId: unknown, input: { targetKind: unknown; targetId: unknown } & CommentInput) {
  const id = await requireWorkspace(db, principal, 'planning_comment', workspaceId)
  if (!['document', 'epic', 'story', 'task'].includes(String(input.targetKind)) || typeof input.targetId !== 'string') throw new AppError('PLANNING_INPUT_INVALID')
  return postMcpComment(db, principal, id, input.targetKind as TargetKind, input.targetId, { body: input.body, parentId: input.parentId })
}

export async function readMcpStory(db: SQL, principal: McpPrincipal, workspaceId: unknown, storyId: unknown) {
  const id = await requireWorkspace(db, principal, 'story_read', workspaceId)
  if (typeof storyId !== 'string') throw new AppError('PLANNING_INPUT_INVALID')
  return getStoryDetails(db, id, storyId, principal.userId, via(principal, id))
}

export async function attachMcpDesign(db: SQL, principal: McpPrincipal, workspaceId: unknown, storyId: unknown, input: { title: unknown; url: unknown; note?: unknown }) {
  const id = await requireWorkspace(db, principal, 'story_attach_design', workspaceId)
  if (typeof storyId !== 'string') throw new AppError('PLANNING_INPUT_INVALID')
  return attachStoryDesign(db, id, storyId, principal.userId, input, via(principal, id))
}

export async function linkMcpDataModel(db: SQL, apps: AppsClient, principal: McpPrincipal, workspaceId: unknown, storyId: unknown, input: { projectId: unknown; tableId: unknown }) {
  const id = await requireWorkspace(db, principal, 'story_link_data_model', workspaceId)
  if (typeof storyId !== 'string') throw new AppError('PLANNING_INPUT_INVALID')
  return linkStoryDataModel(db, apps, await appActorOf(db, principal.userId), id, storyId, input, via(principal, id))
}

// The apps whose tools tools/list shows: every app the account may use anywhere (see app-access).
// Each call checks the named workspace again.
export async function appsForPrincipal(db: SQL, principal: McpPrincipal): Promise<AppName[]> {
  const access = await appRolesOf(db, principal.userId)
  return (['dbdesign', 'stitchkit'] as AppName[]).filter((app) => access[app] !== 'none')
}

// App tools need a workspace where the member is not a viewer and the discipline allows the app. A change needs the
// write rule (Stitchkit: UI/UX only); a read only needs the member to be in the workspace.
export async function requireAppWorkspace(db: SQL, principal: McpPrincipal, app: AppName, workspaceId: unknown, write: boolean): Promise<string> {
  if (typeof workspaceId !== 'string') throw new AppError('WORKSPACE_NOT_FOUND')
  const membership = await findRole(db, workspaceId, principal.userId)
  if (!membership) throw new AppError('WORKSPACE_NOT_FOUND')
  const disciplines = await listUserDisciplines(db, workspaceId, principal.userId)
  if (!workspaceAppAllowed(app, membership, disciplines, write)) throw new AppError('MCP_PERMISSION_DENIED')
  return workspaceId
}

export async function linkMcpContract(db: SQL, principal: McpPrincipal, workspaceId: unknown, storyId: unknown, requestId: unknown) {
  const id = await requireWorkspace(db, principal, 'story_link_api_contract', workspaceId)
  if (typeof storyId !== 'string') throw new AppError('PLANNING_INPUT_INVALID')
  return linkStoryContract(db, id, storyId, principal.userId, { requestId }, via(principal, id))
}

export async function writeMcpTestCase(db: SQL, principal: McpPrincipal, workspaceId: unknown, storyId: unknown, input: { title: unknown; precondition?: unknown; steps: unknown; expected: unknown }) {
  const id = await requireWorkspace(db, principal, 'story_write_test_case', workspaceId)
  if (typeof storyId !== 'string') throw new AppError('PLANNING_INPUT_INVALID')
  return addStoryTestCase(db, id, storyId, principal.userId, input, via(principal, id))
}

// Assigned tasks the member can start now: not done, not locked by a story design, and with every dependency done.
export async function listMcpReadyTasks(db: SQL, principal: McpPrincipal, workspaceId: unknown) {
  const id = await requireWorkspace(db, principal, 'tasks_list_ready', workspaceId)
  const tasks = (await Promise.all((await projectIdsOf(db, id)).map((projectId) => listTasks(db, projectId)))).flat()
  const done = new Set(tasks.filter((task) => task.status === 'done').map((task) => task.id))
  // A task locked by its story is listed too, marked locked. Its role waits for the design to be approved.
  return tasks.filter((task) => task.assigneeId === principal.userId && task.status !== 'done' && task.dependsOn.every((dependency) => done.has(dependency)))
}

async function requireOwnTask(db: SQL, principal: McpPrincipal, tool: McpTool, workspaceId: unknown, taskId: unknown) {
  const id = await requireWorkspace(db, principal, tool, workspaceId)
  const task = typeof taskId === 'string' ? await findTaskInWorkspace(db, taskId, id) : undefined
  if (!task || task.assigneeId !== principal.userId) throw new AppError('TASK_NOT_FOUND')
  return { workspaceId: id, taskId: task.id }
}

export async function listMcpSubtasks(db: SQL, principal: McpPrincipal, workspaceId: unknown, taskId: unknown) {
  const own = await requireOwnTask(db, principal, 'subtasks_list', workspaceId, taskId)
  return getTaskSubtasks(db, own.workspaceId, own.taskId, principal.userId)
}

export async function addMcpSubtask(db: SQL, principal: McpPrincipal, workspaceId: unknown, taskId: unknown, title: unknown) {
  const own = await requireOwnTask(db, principal, 'subtask_add', workspaceId, taskId)
  return addTaskSubtask(db, own.workspaceId, own.taskId, principal.userId, title, principal.keyId)
}

export async function setMcpSubtaskDone(db: SQL, principal: McpPrincipal, workspaceId: unknown, taskId: unknown, subtaskId: unknown, done: unknown) {
  const own = await requireOwnTask(db, principal, 'subtask_set_done', workspaceId, taskId)
  if (typeof subtaskId !== 'string') throw new AppError('TASK_INPUT_INVALID')
  return setTaskSubtaskDone(db, own.workspaceId, own.taskId, subtaskId, principal.userId, done, principal.keyId)
}

export async function writeMcpStoryDetails(
  db: SQL,
  principal: McpPrincipal,
  workspaceId: unknown,
  storyId: unknown,
  input: { userStory: unknown; flow: unknown; definitionOfDone: unknown },
) {
  const id = await requireWorkspace(db, principal, 'story_write_details', workspaceId)
  const story = (input.userStory ?? {}) as Record<string, unknown>
  const complete = filled(story.role) && filled(story.action) && filled(story.benefit) && filled(input.flow) && Array.isArray(input.definitionOfDone) && input.definitionOfDone.length > 0
  if (typeof storyId !== 'string' || !complete) throw new AppError('MCP_DRAFT_INCOMPLETE')
  return updateStoryDetails(db, id, storyId, principal.userId, { userStory: input.userStory, flow: input.flow, definitionOfDone: input.definitionOfDone }, via(principal, id))
}

export async function searchMcpApiRequests(db: SQL, principal: McpPrincipal, workspaceId: unknown, filter: { query?: unknown; method?: unknown }) {
  const id = await requireWorkspace(db, principal, 'api_requests_search', workspaceId)
  if ((filter.query !== undefined && typeof filter.query !== 'string') || (filter.method !== undefined && typeof filter.method !== 'string')) throw new AppError('PLANNING_INPUT_INVALID')
  return searchCollectionRequests(await findHeadSnapshot(db, id), { query: filter.query, method: filter.method })
}

const NOTIFICATION_LIMIT = 50

// The member's notifications from every workspace: comments waiting for an answer, tasks assigned, designs approved.
export async function listMcpNotifications(db: SQL, principal: McpPrincipal, input: { unreadOnly?: unknown; limit?: unknown }) {
  requireTool(principal, 'notifications_list')
  const limit = Number.isInteger(input.limit) && (input.limit as number) > 0 ? Math.min(input.limit as number, NOTIFICATION_LIMIT) : 20
  const unreadCount = await countUnreadNotifications(db, principal.userId)
  if (input.unreadOnly === true) return { items: await listUnreadNotifications(db, principal.userId, limit), unreadCount }
  return { items: (await listNotificationsPage(db, principal.userId, limit, null)).items, unreadCount }
}

export async function markMcpNotificationsRead(db: SQL, principal: McpPrincipal, input: { ids?: unknown; all?: unknown }) {
  requireTool(principal, 'notifications_mark_read')
  if (input.all === true) await markAllNotificationsRead(db, principal.userId)
  else if (Array.isArray(input.ids) && input.ids.length > 0 && input.ids.length <= NOTIFICATION_LIMIT && input.ids.every((value) => typeof value === 'string')) {
    for (const id of input.ids as string[]) await markNotificationRead(db, principal.userId, id)
  } else throw new AppError('PLANNING_INPUT_INVALID')
  return { unreadCount: await countUnreadNotifications(db, principal.userId) }
}

const RESOURCE_URI = /^apidocs:\/\/workspaces\/([\w-]+)\/documents\/([\w-]+)$/
export const DOCUMENT_URI_TEMPLATE = 'apidocs://workspaces/{workspaceId}/documents/{documentId}'

function documentUri(workspaceId: string, documentId: string): string {
  return `apidocs://workspaces/${workspaceId}/documents/${documentId}`
}

// Every document the key may read, in every workspace of the member, as MCP resources the client can attach.
export async function listMcpDocumentResources(db: SQL, principal: McpPrincipal) {
  if (!principal.tools.includes('documents_list')) return []
  const resources: Array<{ uri: string; name: string; title: string; description: string; mimeType: string }> = []
  for (const workspace of await listUserRolesByWorkspace(db, principal.userId)) {
    if (!toolsForRoles(workspace.roles).includes('documents_list')) continue
    const documents = (await listMcpDocuments(db, principal, workspace.id)) as Array<{ id: string; kind: string; title: string; status: string; currentVersion: number }>
    for (const document of documents)
      resources.push({ uri: documentUri(workspace.id, document.id), name: document.title, title: document.title, description: `${document.kind.toUpperCase()} v${document.currentVersion} · ${document.status} · ${workspace.name}`, mimeType: 'text/markdown' })
  }
  return resources
}

export async function readMcpDocumentResource(db: SQL, principal: McpPrincipal, uri: unknown) {
  const match = typeof uri === 'string' ? RESOURCE_URI.exec(uri) : null
  if (!match) throw new AppError('PLANNING_NOT_FOUND')
  const document = (await readMcpReadableDocument(db, principal, match[1], match[2])) as { content: string }
  return [{ uri: uri as string, mimeType: 'text/markdown', text: document.content }]
}

// The issue tools work in the one project of the workspace, as the member who owns the key. A key only drafts and moves
// its owner's own sub-tasks, and the issue service holds it to that.
const asAgent = (principal: McpPrincipal) => ({ userId: principal.userId, apiKeyId: principal.keyId })

// The oldest project, as everywhere else that takes the one project of a workspace. The list is ordered by the last change.
async function issueScope(db: SQL, workspaceId: string) {
  const [project] = (await listProjects(db, workspaceId)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
  if (!project) throw new AppError('PROJECT_NOT_FOUND')
  return { workspaceId, projectId: project.id }
}

const issueRef = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) throw new AppError('ISSUE_INPUT_INVALID')
  return value
}

// The open sprints with their items, then the loose items in pages. The same view as the Backlog tab.
export async function listMcpBacklog(db: SQL, principal: McpPrincipal, workspaceId: unknown, input: { limit?: unknown; cursor?: unknown }) {
  const id = await requireWorkspace(db, principal, 'backlog_list', workspaceId)
  const limit = typeof input.limit === 'number' && Number.isInteger(input.limit) && input.limit >= 1 ? Math.min(input.limit, 100) : 50
  return readBacklog(db, await issueScope(db, id), asAgent(principal), { limit, cursor: decodeCursor(typeof input.cursor === 'string' ? input.cursor : null) })
}

export async function getMcpActiveSprint(db: SQL, principal: McpPrincipal, workspaceId: unknown) {
  const id = await requireWorkspace(db, principal, 'sprint_get_active', workspaceId)
  const { sprints } = await readBacklog(db, await issueScope(db, id), asAgent(principal), { limit: 1, cursor: null })
  const active = sprints.find((sprint) => sprint.status === 'active')
  if (!active) return { sprint: null, issues: [] }
  const { issues, ...sprint } = active
  return { sprint, issues }
}

export async function readMcpIssue(db: SQL, principal: McpPrincipal, workspaceId: unknown, issueId: unknown) {
  const id = await requireWorkspace(db, principal, 'issue_read', workspaceId)
  const scope = await issueScope(db, id)
  const issue = await getIssue(db, scope, asAgent(principal), issueRef(issueId))
  return { issue, checklist: await listChecklist(db, scope, asAgent(principal), issue.id), links: await listLinks(db, scope, asAgent(principal), issue.id) }
}

// Everything an agent drafts waits for a person to publish it.
export async function draftMcpIssue(db: SQL, principal: McpPrincipal, workspaceId: unknown, input: Record<string, unknown>) {
  const id = await requireWorkspace(db, principal, 'issue_draft', workspaceId)
  const { workspaceId: _workspace, clientRequestId: _request, ...fields } = input
  return createIssue(db, await issueScope(db, id), asAgent(principal), parseInput(createIssueBody, fields, 'ISSUE_INPUT_INVALID'))
}

export async function commentMcpIssue(db: SQL, principal: McpPrincipal, workspaceId: unknown, issueId: unknown, input: CommentInput) {
  const id = await requireWorkspace(db, principal, 'issue_comment', workspaceId)
  const issue = await getIssue(db, await issueScope(db, id), asAgent(principal), issueRef(issueId))
  const kind: TargetKind = issue.type === 'epic' ? 'epic' : issue.type === 'story' ? 'story' : 'task'
  return postMcpComment(db, principal, id, kind, issue.id, input)
}

export async function updateMcpSubtaskStatus(db: SQL, principal: McpPrincipal, workspaceId: unknown, subtaskId: unknown, status: unknown) {
  const id = await requireWorkspace(db, principal, 'subtask_update_status', workspaceId)
  const scope = await issueScope(db, id)
  const subtask = await getIssue(db, scope, asAgent(principal), issueRef(subtaskId))
  if (subtask.type !== 'subtask' || typeof status !== 'string') throw new AppError('ISSUE_INPUT_INVALID')
  return updateIssue(db, scope, asAgent(principal), subtask.id, { status })
}

export async function setMcpChecklistItemDone(db: SQL, principal: McpPrincipal, workspaceId: unknown, issueId: unknown, itemId: unknown, done: unknown) {
  const id = await requireWorkspace(db, principal, 'checklist_set_done', workspaceId)
  if (typeof itemId !== 'string' || typeof done !== 'boolean') throw new AppError('ISSUE_INPUT_INVALID')
  return setChecklistItemDone(db, await issueScope(db, id), asAgent(principal), issueRef(issueId), itemId, done)
}
