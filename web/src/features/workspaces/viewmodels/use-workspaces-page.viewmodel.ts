import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { COMMON_TEXT } from '@/shared/constants/common-text.constants'
import { ApiError } from '@/shared/services/api-client'
import type { WorkspaceListStatus } from '../models/workspaces.model'
import { useWorkspacesQuery } from './use-workspaces.viewmodel'

export function useWorkspacesPageViewModel() {
  const { t } = useTranslation(['workspaces', 'common'])
  const token = useAuthSessionStore((state) => state.token)
  const query = useWorkspacesQuery(token)
  const workspaces = query.workspaces

  const status: WorkspaceListStatus = query.isPending ? 'loading' : query.isError ? 'error' : workspaces.length === 0 ? 'empty' : 'ready'

  return {
    status,
    workspaces,
    ownedCount: workspaces.filter((workspace) => workspace.role === 'owner').length,
    errorMessage: query.error ? (query.error instanceof ApiError ? query.error.message : t(COMMON_TEXT.error.unexpected)) : null,
    hasMore: query.hasMore,
    isLoadingMore: query.isLoadingMore,
    loadMore: query.loadMore,
    retry: () => {
      void query.refetch()
    },
  }
}
