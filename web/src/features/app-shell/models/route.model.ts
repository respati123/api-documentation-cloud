export const WORKSPACE_TABS = ['overview', 'docs', 'projects', 'activity', 'team', 'settings'] as const

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number]

export type AppRoute =
  | { page: 'overview' }
  | { page: 'workspaces' }
  | { page: 'mcp' }
  | { page: 'admin-mcp' }
  | { page: 'admin-workspaces' }
  | { page: 'workspace'; workspaceId: string; tab?: WorkspaceTab }
