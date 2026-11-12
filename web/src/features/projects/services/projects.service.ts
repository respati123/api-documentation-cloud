import * as z from 'zod/mini'
import {
  type Project,
  type ProjectDiscipline,
  projectMemberSchema,
  projectSchema,
  type Task,
  taskSchema,
} from '@/features/projects/models/project.model'
import { subtaskSchema } from '@/features/projects/models/story.model'
import { workspaceCall } from '@/features/projects/services/workspace-transport'

export const projectsService = {
  list: async (token: string, workspaceId: string): Promise<Project[]> => {
    const result = z.parse(z.object({ projects: z.array(projectSchema) }), await workspaceCall(workspaceId, `/projects`, { token }))
    return result.projects
  },
  tasks: async (token: string, workspaceId: string, projectId: string): Promise<Task[]> => {
    const result = z.parse(
      z.object({ tasks: z.array(taskSchema) }),
      await workspaceCall(workspaceId, `/projects/${projectId}/tasks`, { token }),
    )
    return result.tasks
  },
  members: async (token: string, workspaceId: string) =>
    z.parse(z.object({ members: z.array(projectMemberSchema) }), await workspaceCall(workspaceId, `/project-members`, { token })).members,
  projectMembers: async (token: string, workspaceId: string, projectId: string) =>
    z.parse(
      z.object({ members: z.array(projectMemberSchema) }),
      await workspaceCall(workspaceId, `/projects/${projectId}/members`, { token }),
    ).members,
  assignProjectMember: async (token: string, workspaceId: string, projectId: string, userId: string, discipline: ProjectDiscipline) =>
    workspaceCall(workspaceId, `/projects/${projectId}/members`, { token, method: 'POST', body: { userId, discipline } }),
  createTask: async (
    token: string,
    workspaceId: string,
    projectId: string,
    input: {
      title: string
      assigneeId: string | null
      priority: Task['priority']
      description: string
      dueDate: string | null
      status: Task['status']
    },
  ): Promise<Task> => {
    const result = z.parse(
      z.object({ task: taskSchema }),
      await workspaceCall(workspaceId, `/projects/${projectId}/tasks`, {
        token,
        method: 'POST',
        body: input,
      }),
    )
    return result.task
  },
  moveTask: async (token: string, workspaceId: string, taskId: string, status: Task['status']): Promise<Task> => {
    const result = z.parse(
      z.object({ task: taskSchema }),
      await workspaceCall(workspaceId, `/tasks/${taskId}`, { token, method: 'PATCH', body: { status } }),
    )
    return result.task
  },
  updateTask: async (
    token: string,
    workspaceId: string,
    taskId: string,
    input: {
      title: string
      description: string
      assigneeId: string | null
      priority: Task['priority']
      dueDate: string | null
      status: Task['status']
    },
  ): Promise<Task> => {
    const result = z.parse(
      z.object({ task: taskSchema }),
      await workspaceCall(workspaceId, `/tasks/${taskId}`, { token, method: 'PATCH', body: input }),
    )
    return result.task
  },
  subtasks: async (token: string, workspaceId: string, taskId: string) =>
    z.parse(z.object({ subtasks: z.array(subtaskSchema) }), await workspaceCall(workspaceId, `/tasks/${taskId}/subtasks`, { token }))
      .subtasks,
  addSubtask: (token: string, workspaceId: string, taskId: string, title: string) =>
    workspaceCall(workspaceId, `/tasks/${taskId}/subtasks`, { token, method: 'POST', body: { title } }),
  setSubtaskDone: (token: string, workspaceId: string, taskId: string, subtaskId: string, done: boolean) =>
    workspaceCall(workspaceId, `/tasks/${taskId}/subtasks/${subtaskId}`, { token, method: 'PATCH', body: { done } }),
}
