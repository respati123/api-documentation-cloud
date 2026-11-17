import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ADMIN_WORKSPACES_TEXT } from '@/features/admin-workspaces/constants/admin-workspaces-text.constants'
import { adminWorkspacesService } from '@/features/admin-workspaces/services/admin-workspaces.service'
import { useAuthSessionStore } from '@/features/auth'
import { usePageList } from '@/shared/hooks/use-page-list'
import { readErrorMessage } from '@/shared/utils/error-message'

export const adminWorkspaceQueryKeys = {
  list: (query: string) => ['admin-workspaces', query] as const,
}

export function useAdminWorkspacesViewModel() {
  const { t } = useTranslation('admin')
  const token = useAuthSessionStore((state) => state.token)
  const isAdmin = useAuthSessionStore((state) => state.isAdmin)
  const [search, setSearch] = useState('')
  const query = useDeferredValue(search)

  const workspaces = usePageList({
    queryKey: adminWorkspaceQueryKeys.list(query),
    fetchPage: (cursor) => adminWorkspacesService.list(token, query, cursor),
    enabled: isAdmin,
  })

  return {
    search,
    setSearch,
    workspaces: workspaces.items,
    status: workspaces.isPending ? ('loading' as const) : workspaces.items.length ? ('ready' as const) : ('empty' as const),
    hasMore: workspaces.hasMore,
    isLoadingMore: workspaces.isLoadingMore,
    loadMore: workspaces.loadMore,
    error: workspaces.error ? readErrorMessage(workspaces.error, t(ADMIN_WORKSPACES_TEXT.error)) : null,
  }
}
