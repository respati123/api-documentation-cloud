import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SHELL_TEXT } from '@/features/app-shell/constants/app-shell-text.constants'
import type { AppRoute } from '@/features/app-shell/models/route.model'
import { buildSidebar } from '@/features/app-shell/utils/sidebar'
import { readApiExpanded, writeApiExpanded } from '@/features/app-shell/utils/sidebar-storage'
import { useAppRouteViewModel } from '@/features/app-shell/viewmodels/use-app-route.viewmodel'
import { useAuthSessionViewModel } from '@/features/auth'
import { useCreateWorkspaceStore, useWorkspacesQuery, workspacesKeys } from '@/features/workspaces'
import { ApiError, checkApiHealth } from '@/shared/services/api-client'
import { showToast } from '@/shared/toast/toast-manager'

export const shellKeys = {
  health: ['api-health'] as const,
}

export function useAppShellViewModel() {
  const session = useAuthSessionViewModel()
  const queryClient = useQueryClient()
  const workspacesQuery = useWorkspacesQuery(session.token)
  const healthQuery = useQuery({
    queryKey: shellKeys.health,
    queryFn: checkApiHealth,
    staleTime: 60_000,
  })
  const openCreateWorkspace = useCreateWorkspaceStore((state) => state.open)
  const { t } = useTranslation('shell')
  const { route, navigate: changeRoute } = useAppRouteViewModel()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [apiExpanded, setApiExpanded] = useState(readApiExpanded)
  const workspaces = workspacesQuery.workspaces
  const currentWorkspace = route.page === 'workspace' ? (workspaces.find((item) => item.id === route.workspaceId) ?? null) : null

  function navigate(next: AppRoute, replace = false) {
    setMobileNavOpen(false)
    changeRoute(next, replace)
  }

  async function signOut() {
    try {
      await session.signOut()
    } catch (error) {
      // The server kept the session, so the workspace stays on screen with the reason.
      showToast({ kind: 'error', message: error instanceof ApiError ? error.message : t(SHELL_TEXT.account.signOutFailed) })
      return
    }
    queryClient.removeQueries({ queryKey: workspacesKeys.all })
    queryClient.removeQueries({ queryKey: ['workspace-detail'] })
    navigate({ page: 'overview' }, true)
  }

  return {
    route,
    navigate,
    user: session.user,
    workspaces,
    currentWorkspace,
    sidebarItems: buildSidebar(route, workspaces),
    apiExpanded,
    setApiExpanded: (expanded: boolean) => {
      setApiExpanded(expanded)
      writeApiExpanded(expanded)
    },
    hasMoreWorkspaces: workspacesQuery.hasMore,
    isLoadingMoreWorkspaces: workspacesQuery.isLoadingMore,
    loadMoreWorkspaces: workspacesQuery.loadMore,
    apiOnline: healthQuery.data ?? null,
    mobileNavOpen,
    setMobileNavOpen,
    signOut,
    openCreateWorkspace,
  }
}
