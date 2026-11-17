import type { AppRoute } from '@/features/app-shell/models/route.model'

export type SidebarItemId = 'home' | 'workspaces' | 'overview' | 'api' | 'collections' | 'history' | 'projects' | 'team' | 'settings'

export interface SidebarItem {
  id: SidebarItemId
  label: string
  route: AppRoute
  active: boolean
  count?: number
  children?: SidebarItem[]
}
