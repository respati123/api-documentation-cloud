import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthSessionViewModel } from '@/features/auth'
import { useCreateWorkspaceStore, useWorkspacesQuery, workspacesKeys } from '@/features/workspaces'
import { checkApiHealth } from '@/shared/services/api-client'
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
  const { route, navigate: changeRoute } = useAppRouteViewModel()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  function navigate(next: AppRoute, replace = false) {
    setMobileNavOpen(false)
    changeRoute(next, replace)
  }

  async function signOut() {
    await session.signOut()
    queryClient.removeQueries({ queryKey: workspacesKeys.all })
    queryClient.removeQueries({ queryKey: ['workspace-detail'] })
    navigate({ page: 'overview' }, true)
  }

  return {
    route,
    navigate,
    user: session.user,
    workspaces: workspacesQuery.data ?? [],
    apiOnline: healthQuery.data ?? null,
    mobileNavOpen,
    setMobileNavOpen,
    signOut,
    openCreateWorkspace,
  }
}
