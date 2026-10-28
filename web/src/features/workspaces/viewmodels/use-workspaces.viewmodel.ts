import { useInfiniteQuery } from '@tanstack/react-query'
import { workspacesService } from '../services/workspaces.service'

export const workspacesKeys = {
  all: ['workspaces'] as const,
  list: (token: string) => [...workspacesKeys.all, 'list', token] as const,
}

// Pages are loaded on demand. `workspaces` holds every page loaded so far.
export function useWorkspacesQuery(token: string) {
  const query = useInfiniteQuery({
    queryKey: workspacesKeys.list(token),
    queryFn: ({ pageParam }) => workspacesService.listPage(token, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: token !== '',
    staleTime: 30_000,
  })

  return {
    workspaces: query.data?.pages.flatMap((page) => page.items) ?? [],
    counts: query.data?.pages[0]?.counts ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    refetch: query.refetch,
  }
}
