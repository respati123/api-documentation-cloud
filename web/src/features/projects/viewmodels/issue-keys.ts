export const issueKeys = {
  all: (workspaceId: string, projectId: string) => ['issues', workspaceId, projectId] as const,
  backlog: (workspaceId: string, projectId: string) => ['issues', workspaceId, projectId, 'backlog'] as const,
  sprints: (workspaceId: string, projectId: string) => ['issues', workspaceId, projectId, 'sprints'] as const,
  subtasks: (workspaceId: string, projectId: string) => ['issues', workspaceId, projectId, 'subtasks'] as const,
  children: (workspaceId: string, projectId: string, ref: string) => ['issues', workspaceId, projectId, 'issue', ref, 'children'] as const,
  epics: (workspaceId: string, projectId: string) => ['issues', workspaceId, projectId, 'epics'] as const,
  issue: (workspaceId: string, projectId: string, ref: string) => ['issues', workspaceId, projectId, 'issue', ref] as const,
  checklist: (workspaceId: string, projectId: string, ref: string) =>
    ['issues', workspaceId, projectId, 'issue', ref, 'checklist'] as const,
  reports: (workspaceId: string, projectId: string) => ['issues', workspaceId, projectId, 'reports'] as const,
  wipLimits: (workspaceId: string, projectId: string) => ['issues', workspaceId, projectId, 'wip-limits'] as const,
  links: (workspaceId: string, projectId: string, ref: string) => ['issues', workspaceId, projectId, 'issue', ref, 'links'] as const,
}
