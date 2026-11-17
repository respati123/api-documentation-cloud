import { SHELL_TEXT } from '@/features/app-shell/constants/app-shell-text.constants'
import type { AppRoute, WorkspaceTab } from '@/features/app-shell/models/route.model'
import type { SidebarItem } from '@/features/app-shell/models/sidebar.model'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'

export function buildSidebar(route: AppRoute, workspaces: CloudWorkspaceRef[]): SidebarItem[] {
  if (route.page !== 'workspace') {
    return [
      { id: 'home', label: SHELL_TEXT.nav.overview, route: { page: 'overview' }, active: route.page === 'overview' },
      {
        id: 'workspaces',
        label: SHELL_TEXT.nav.workspaces,
        route: { page: 'workspaces' },
        active: route.page === 'workspaces',
        count: workspaces.length,
      },
    ]
  }

  const { workspaceId } = route
  const activeTab = route.tab ?? 'overview'
  const link = (id: WorkspaceTab, label: string): SidebarItem => ({
    id,
    label,
    route: { page: 'workspace', workspaceId, tab: id },
    active: activeTab === id,
  })
  const apiChildren = [link('collections', SHELL_TEXT.nav.collections), link('history', SHELL_TEXT.nav.history)]
  const designChildren = [link('design-ui', SHELL_TEXT.nav.designUi), link('design-database', SHELL_TEXT.nav.designDatabase)]
  const isOwner = workspaces.some((item) => item.id === workspaceId && item.role === 'owner')

  return [
    link('overview', SHELL_TEXT.nav.workspaceOverview),
    {
      id: 'api',
      label: SHELL_TEXT.nav.api,
      route: apiChildren[0].route,
      active: apiChildren.some((item) => item.active),
      children: apiChildren,
    },
    {
      id: 'design',
      label: SHELL_TEXT.nav.design,
      route: designChildren[0].route,
      active: designChildren.some((item) => item.active),
      children: designChildren,
    },
    link('projects', SHELL_TEXT.nav.projects),
    link('team', SHELL_TEXT.nav.team),
    ...(isOwner ? [link('settings', SHELL_TEXT.nav.settings)] : []),
  ]
}
