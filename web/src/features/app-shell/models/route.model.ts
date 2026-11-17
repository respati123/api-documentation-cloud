export const WORKSPACE_TABS = [
  'overview',
  'collections',
  'history',
  'design-ui',
  'design-database',
  'projects',
  'team',
  'settings',
] as const

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number]

// The sections grouped under API in the sidebar, served under /w/:id/api/.
export const API_TABS = ['collections', 'history'] as const satisfies readonly WorkspaceTab[]

export type ApiTab = (typeof API_TABS)[number]

// The sections grouped under Design in the sidebar, served under /w/:id/design/ (ui is Stitchkit, database is DBDesign).
export const DESIGN_TABS = ['design-ui', 'design-database'] as const satisfies readonly WorkspaceTab[]

export type DesignTab = (typeof DESIGN_TABS)[number]

export type AppRoute =
  | { page: 'overview' }
  | { page: 'workspaces' }
  | { page: 'mcp' }
  | { page: 'admin-mcp' }
  | { page: 'admin-workspaces' }
  | { page: 'workspace'; workspaceId: string; tab?: WorkspaceTab; commitId?: string }
