import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { insertStatusEvent } from '@/repositories/issues.repository'
import { AppError } from '@/lib/errors/app-error'
import { PROJECT_DISCIPLINES, type ProjectDiscipline, type TaskPriority, type TaskStatus } from '@/models/project'
import { ensureAssigneeInProject, ensureAssigneeInWorkspace, ensureWorkspaceProject, findTaskInWorkspace, hasProjectDiscipline, insertSubtask, insertTask, isProjectInWorkspace, isTaskAssigneeInProject, listProjectMembers, listSubtasks, listTasks, listWorkspaceMembers, replaceTaskDependencies, setProjectMemberDisciplines, setSubtaskDone, updateTaskInWorkspace } from '@/repositories/projects.repository'
import { isWorkRole } from '@/models/story'
import { insertPlanningEvent } from '@/repositories/planning-events.repository'
import { findUserById } from '@/repositories/users.repository'
import { notify } from '@/services/notifications'
import { resolveAccess } from '@/services/access'

const disciplines: readonly ProjectDiscipline[] = PROJECT_DISCIPLINES
const statuses: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done']
const priorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

export async function getProjects(db: SQL, workspaceId: string) {
  return [await ensureWorkspaceProject(db, workspaceId)]
}

export async function getProjectTasks(db: SQL, workspaceId: string, projectId: string) {
  if (!(await isProjectInWorkspace(db, projectId, workspaceId))) throw new AppError('PROJECT_NOT_FOUND')
  return listTasks(db, projectId)
}

export async function createProjectTask(db: SQL, workspaceId: string, projectId: string, userId: string, input: { title: string; description: string; status: TaskStatus; priority: TaskPriority; assigneeId: string | null; dueDate: string | null; role?: string | null }) {
  const role = (await resolveAccess(db, workspaceId, userId))?.role
  if (!role) throw new AppError('WORKSPACE_NOT_FOUND')
  if (role === 'viewer') throw new AppError('ROLE_NOT_ALLOWED')
  if (!(await isProjectInWorkspace(db, projectId, workspaceId))) throw new AppError('PROJECT_NOT_FOUND')
  if (input.title.trim().length < 1 || input.title.trim().length > 180 || input.description.length > 8000 || !statuses.includes(input.status) || !priorities.includes(input.priority) || !(await ensureAssigneeInProject(db, workspaceId, projectId, input.assigneeId))) throw new AppError('TASK_INPUT_INVALID')
  if (input.role !== undefined && input.role !== null && !isWorkRole(input.role)) throw new AppError('TASK_INPUT_INVALID')
  const task = await insertTask(db, { id: randomUUID(), projectId, ...input, role: input.role ?? null, title: input.title.trim(), description: input.description.trim(), createdBy: userId })
  await notifyAssignee(db, workspaceId, userId, task.assigneeId, task.title)
  return task
}

export async function changeProjectTask(db: SQL, workspaceId: string, taskId: string, userId: string, input: { title?: string; description?: string; status?: TaskStatus; priority?: TaskPriority; assigneeId?: string | null; dueDate?: string | null; role?: string | null; dependsOn?: string[] }) {
  const role = (await resolveAccess(db, workspaceId, userId))?.role
  if (!role) throw new AppError('WORKSPACE_NOT_FOUND')
  if (role === 'viewer') throw new AppError('ROLE_NOT_ALLOWED')
  if (input.title !== undefined && (input.title.trim().length < 1 || input.title.trim().length > 180)) throw new AppError('TASK_INPUT_INVALID')
  if (input.description !== undefined && input.description.length > 8000) throw new AppError('TASK_INPUT_INVALID')
  if (input.status !== undefined && !statuses.includes(input.status)) throw new AppError('TASK_INPUT_INVALID')
  if (input.priority !== undefined && !priorities.includes(input.priority)) throw new AppError('TASK_INPUT_INVALID')
  if (input.assigneeId && !(await isTaskAssigneeInProject(db, taskId, workspaceId, input.assigneeId))) throw new AppError('TASK_INPUT_INVALID')
  if (input.role !== undefined && input.role !== null && !isWorkRole(input.role)) throw new AppError('TASK_INPUT_INVALID')
  const current = await findTaskInWorkspace(db, taskId, workspaceId)
  if (!current) throw new AppError('TASK_NOT_FOUND')
  if (input.status && input.status !== current.status && input.status !== 'backlog' && current.locked) throw new AppError('TASK_LOCKED')
  if (input.dependsOn !== undefined && (input.dependsOn.length > 20 || !(await replaceTaskDependencies(db, taskId, input.dependsOn)))) throw new AppError('TASK_INPUT_INVALID')
  const { dependsOn: _dependsOn, ...fields } = input
  const task = await updateTaskInWorkspace(db, taskId, workspaceId, { ...fields, ...(input.title === undefined ? {} : { title: input.title.trim() }) })
  if (!task) throw new AppError('TASK_NOT_FOUND')
  if (task.assigneeId !== current.assigneeId) await notifyAssignee(db, workspaceId, userId, task.assigneeId, task.title)
  if (task.status !== current.status) await recordTaskEvent(db, workspaceId, task.id, userId, `status:${task.status}`)
  return task
}

// A status change also goes into the status history, which the reports read.
export async function recordTaskEvent(db: SQL, workspaceId: string, taskId: string, actorId: string, action: string, apiKeyId: string | null = null) {
  await insertPlanningEvent(db, { workspaceId, actorId, apiKeyId, targetKind: 'task', targetId: taskId, action })
  if (action.startsWith('status:')) await insertStatusEvent(db, { id: randomUUID(), issueId: taskId, fromStatus: null, toStatus: action.slice('status:'.length), actorId, apiKeyId })
}

// The new assignee hears about the task, unless they assigned it to themselves.
async function notifyAssignee(db: SQL, workspaceId: string, actorId: string, assigneeId: string | null, title: string) {
  if (!assigneeId || assigneeId === actorId) return
  const actor = await findUserById(db, actorId)
  await notify(db, assigneeId, 'task_assigned', `/w/${workspaceId}/projects`, { actor: actor?.email.split('@')[0] ?? '', title })
}

// Anyone in the workspace reads sub-tasks. Editors, the owner, and the task's assignee change them.
async function taskForSubtasks(db: SQL, workspaceId: string, taskId: string, userId: string, write: boolean) {
  const role = (await resolveAccess(db, workspaceId, userId))?.role
  if (!role) throw new AppError('WORKSPACE_NOT_FOUND')
  const task = await findTaskInWorkspace(db, taskId, workspaceId)
  if (!task) throw new AppError('TASK_NOT_FOUND')
  if (write && role === 'viewer' && task.assigneeId !== userId) throw new AppError('ROLE_NOT_ALLOWED')
  return task
}

export async function getTaskSubtasks(db: SQL, workspaceId: string, taskId: string, userId: string) {
  await taskForSubtasks(db, workspaceId, taskId, userId, false)
  return listSubtasks(db, taskId)
}

export async function addTaskSubtask(db: SQL, workspaceId: string, taskId: string, userId: string, title: unknown, apiKeyId: string | null = null) {
  const task = await taskForSubtasks(db, workspaceId, taskId, userId, true)
  if (typeof title !== 'string' || title.trim().length < 1 || title.trim().length > 300) throw new AppError('TASK_INPUT_INVALID')
  const subtask = await insertSubtask(db, { id: randomUUID(), taskId, title: title.trim(), assigneeId: task.assigneeId })
  await recordTaskEvent(db, workspaceId, taskId, userId, 'subtask_added', apiKeyId)
  return subtask
}

export async function setTaskSubtaskDone(db: SQL, workspaceId: string, taskId: string, subtaskId: string, userId: string, done: unknown, apiKeyId: string | null = null) {
  await taskForSubtasks(db, workspaceId, taskId, userId, true)
  if (typeof done !== 'boolean') throw new AppError('TASK_INPUT_INVALID')
  const subtask = await setSubtaskDone(db, taskId, subtaskId, done)
  if (!subtask) throw new AppError('SUBTASK_NOT_FOUND')
  if (done) await recordTaskEvent(db, workspaceId, taskId, userId, 'subtask_done', apiKeyId)
  return subtask
}

export async function getWorkspaceProjectMembers(db: SQL, workspaceId: string) {
  return listWorkspaceMembers(db, workspaceId)
}

export async function getProjectMembers(db: SQL, workspaceId: string, projectId: string) {
  if (!(await isProjectInWorkspace(db, projectId, workspaceId))) throw new AppError('PROJECT_NOT_FOUND')
  return listProjectMembers(db, projectId)
}

// The owner, or a PM of the project, sets a member's roles. Several roles are allowed, and an empty list removes them.
export async function assignProjectMember(db: SQL, workspaceId: string, projectId: string, actorId: string, userId: string, roles: ProjectDiscipline[]) {
  const role = (await resolveAccess(db, workspaceId, actorId))?.role
  if (!role) throw new AppError('WORKSPACE_NOT_FOUND')
  if (role === 'viewer') throw new AppError('ROLE_NOT_ALLOWED')
  const unique = [...new Set(roles)]
  if (unique.length > disciplines.length || unique.some((value) => !disciplines.includes(value)) || !(await isProjectInWorkspace(db, projectId, workspaceId)) || !(await ensureAssigneeInWorkspace(db, workspaceId, userId))) throw new AppError('PROJECT_INPUT_INVALID')
  if (role !== 'owner' && !(await hasProjectDiscipline(db, projectId, actorId, 'pm'))) throw new AppError('ROLE_NOT_ALLOWED')
  await setProjectMemberDisciplines(db, projectId, userId, unique)
  const member = (await listProjectMembers(db, projectId)).find((row) => row.id === userId)
  return member ?? { id: userId, email: '', discipline: null, disciplines: [] }
}
