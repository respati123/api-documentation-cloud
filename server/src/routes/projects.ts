import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { PROJECT_DISCIPLINES, type ProjectDiscipline, type TaskPriority, type TaskStatus } from '@/models/project'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { created, ok } from '@/lib/http'
import { requireRole } from '@/services/access'
import { addTaskSubtask, assignProjectMember, changeProjectTask, createProjectTask, getProjectMembers, getProjectTasks, getProjects, getTaskSubtasks, getWorkspaceProjectMembers, setTaskSubtaskDone } from '@/services/projects'

const disciplines: readonly ProjectDiscipline[] = PROJECT_DISCIPLINES
const statuses: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done']
const priorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

export async function handleProjectRoutes(ctx: AppContext, request: Request, method: string, workspaceId: string, action: string, user: AuthUser): Promise<Response | undefined> {
  const { db } = ctx
  if (method === 'GET' && action === 'projects') {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
    return ok({ projects: await getProjects(db, workspaceId) })
  }

  if (method === 'GET' && action === 'project-members') {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
    return ok({ members: await getWorkspaceProjectMembers(db, workspaceId) })
  }

  const projectMembersMatch = action.match(/^projects\/([\w-]+)\/members$/)
  if (projectMembersMatch && method === 'GET') {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
    return ok({ members: await getProjectMembers(db, workspaceId, projectMembersMatch[1]) })
  }
  if (projectMembersMatch && method === 'POST') {
    const body = await bodyOf(request)
    if (typeof body.userId !== 'string' || typeof body.discipline !== 'string' || !disciplines.includes(body.discipline as ProjectDiscipline)) throw new AppError('PROJECT_INPUT_INVALID')
    return ok({ member: await assignProjectMember(db, workspaceId, projectMembersMatch[1], user.id, body.userId, body.discipline as ProjectDiscipline) })
  }

  const taskCollection = action.match(/^projects\/([\w-]+)\/tasks$/)
  if (taskCollection && method === 'GET') {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
    return ok({ tasks: await getProjectTasks(db, workspaceId, taskCollection[1]) })
  }
  if (taskCollection && method === 'POST') {
    const body = await bodyOf(request)
    if (typeof body.title !== 'string' || (body.description !== undefined && typeof body.description !== 'string') || (body.status !== undefined && (typeof body.status !== 'string' || !statuses.includes(body.status as TaskStatus))) || (body.priority !== undefined && (typeof body.priority !== 'string' || !priorities.includes(body.priority as TaskPriority))) || (body.assigneeId !== undefined && body.assigneeId !== null && typeof body.assigneeId !== 'string') || (body.dueDate !== undefined && body.dueDate !== null && typeof body.dueDate !== 'string')) throw new AppError('TASK_INPUT_INVALID')
    const task = await createProjectTask(db, workspaceId, taskCollection[1], user.id, {
      title: body.title,
      description: typeof body.description === 'string' ? body.description : '',
      status: typeof body.status === 'string' ? body.status as TaskStatus : 'backlog',
      priority: typeof body.priority === 'string' ? body.priority as TaskPriority : 'medium',
      assigneeId: typeof body.assigneeId === 'string' ? body.assigneeId : null,
      dueDate: typeof body.dueDate === 'string' ? body.dueDate : null,
      ...(body.role === null || typeof body.role === 'string' ? { role: body.role } : {}),
    })
    return created({ task })
  }

  const taskMatch = action.match(/^tasks\/([\w-]+)$/)
  if (taskMatch && method === 'PATCH') {
    const body = await bodyOf(request)
    if ((body.title !== undefined && typeof body.title !== 'string') || (body.description !== undefined && typeof body.description !== 'string') || (body.status !== undefined && (typeof body.status !== 'string' || !statuses.includes(body.status as TaskStatus))) || (body.priority !== undefined && (typeof body.priority !== 'string' || !priorities.includes(body.priority as TaskPriority))) || (body.assigneeId !== undefined && body.assigneeId !== null && typeof body.assigneeId !== 'string') || (body.dueDate !== undefined && body.dueDate !== null && typeof body.dueDate !== 'string')) throw new AppError('TASK_INPUT_INVALID')
    return ok({ task: await changeProjectTask(db, workspaceId, taskMatch[1], user.id, {
      ...(typeof body.title === 'string' ? { title: body.title } : {}),
      ...(typeof body.description === 'string' ? { description: body.description } : {}),
      ...(typeof body.status === 'string' ? { status: body.status as TaskStatus } : {}),
      ...(typeof body.priority === 'string' ? { priority: body.priority as TaskPriority } : {}),
      ...(body.assigneeId === null || typeof body.assigneeId === 'string' ? { assigneeId: body.assigneeId } : {}),
      ...(body.dueDate === null || typeof body.dueDate === 'string' ? { dueDate: body.dueDate } : {}),
      ...(body.role === null || typeof body.role === 'string' ? { role: body.role } : {}),
      ...(Array.isArray(body.dependsOn) && body.dependsOn.every((id) => typeof id === 'string') ? { dependsOn: body.dependsOn as string[] } : {}),
    }) })
  }

  const subtasksMatch = action.match(/^tasks\/([\w-]+)\/subtasks(?:\/([\w-]+))?$/)
  if (subtasksMatch) {
    const [, taskId, subtaskId] = subtasksMatch
    if (!subtaskId && method === 'GET') return ok({ subtasks: await getTaskSubtasks(db, workspaceId, taskId, user.id) })
    if (!subtaskId && method === 'POST') return created({ subtask: await addTaskSubtask(db, workspaceId, taskId, user.id, (await bodyOf(request)).title) })
    if (subtaskId && method === 'PATCH') return ok({ subtask: await setTaskSubtaskDone(db, workspaceId, taskId, subtaskId, user.id, (await bodyOf(request)).done) })
  }
  return undefined
}
