export const WORKSPACE_TABS = ['overview', 'docs', 'activity', 'team', 'settings'] as const

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number]

export type AppRoute = { page: 'overview' } | { page: 'workspaces' } | { page: 'workspace'; workspaceId: string; tab?: WorkspaceTab }
