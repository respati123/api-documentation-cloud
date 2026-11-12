export const projectKeys = {
  all: ['projects'] as const,
  list: (workspaceId: string) => [...projectKeys.all, workspaceId] as const,
  tasks: (workspaceId: string, projectId: string) => [...projectKeys.all, workspaceId, projectId, 'tasks'] as const,
  subtasks: (workspaceId: string, taskId: string) => [...projectKeys.all, workspaceId, 'subtasks', taskId] as const,
}
