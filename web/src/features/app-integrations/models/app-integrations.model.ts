export type AppName = 'dbdesign' | 'stitchkit'

export interface AppLink {
  id: string
  projectId: string
  name: string
  url: string | null
}

export interface WorkspaceApp {
  app: AppName
  enabled: boolean
  baseUrl: string | null
  links: AppLink[]
}

export interface WorkspaceApps {
  canManage: boolean
  apps: WorkspaceApp[]
}

export interface AppProject {
  id: string
  name: string
}

// Screens or tables of one linked project. A project the member cannot open in the app carries its error code.
export interface LinkedProjectItems<T> {
  projectId: string
  projectName: string
  items: T[]
  error: string | null
}

export interface StitchkitScreen {
  id: string
  name: string
  url: string | null
}

export interface DbdesignTable {
  id: string
  name: string
}
