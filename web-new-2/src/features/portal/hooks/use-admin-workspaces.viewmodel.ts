import { useDeferredValue, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { portalService } from '../services/portal.service'
import { portalKeys } from './portal.keys'

// Every workspace in the app. Opening one reads it as a viewer unless the admin is a member.
export function useAdminWorkspacesViewModel({
  authenticated,
  isAdmin,
  active,
  openWorkspace,
}: {
  authenticated: boolean
  isAdmin: boolean
  active: boolean
  openWorkspace: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const workspaces = useInfiniteQuery({
    queryKey: portalKeys.adminWorkspaces(deferredSearch),
    queryFn: ({ pageParam }) => portalService.adminWorkspaces(deferredSearch, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: authenticated && isAdmin && active,
  })
  const items = workspaces.data?.pages.flatMap(page => page.items) ?? []
  return {
    search,
    setSearch,
    items,
    status: workspaces.isPending ? 'loading' as const : workspaces.isError ? 'error' as const : items.length ? 'ready' as const : 'empty' as const,
    error: workspaces.error,
    retry: () => void workspaces.refetch(),
    hasNextPage: workspaces.hasNextPage,
    isFetchingNextPage: workspaces.isFetchingNextPage,
    loadMore: () => void workspaces.fetchNextPage(),
    open: openWorkspace,
  }
}

export type AdminWorkspacesViewModel = ReturnType<typeof useAdminWorkspacesViewModel>
