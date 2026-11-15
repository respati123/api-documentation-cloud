import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionViewModel } from '@/features/auth'
import { useCreateWorkspaceStore, useWorkspacesQuery, workspacesKeys } from '@/features/workspaces'
import { ApiError, checkApiHealth } from '@/shared/services/api-client'
import { showToast } from '@/shared/toast/toast-manager'
import { SHELL_TEXT } from '../constants/app-shell-text.constants'
import type { AppRoute } from '../models/route.model'
import { useAppRouteViewModel } from './use-app-route.viewmodel'

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
    workspaces: workspacesQuery.workspaces,
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
