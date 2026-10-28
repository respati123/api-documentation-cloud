import { useInfiniteQuery } from '@tanstack/react-query'
import type { Page } from '@/shared/models/page.model'

// Loads a cursor-paged list. `items` holds every page loaded so far, in order.
export function usePageList<T>({
  queryKey,
  fetchPage,
  enabled,
}: {
  queryKey: readonly unknown[]
  fetchPage: (cursor: string | null) => Promise<Page<T>>
  enabled: boolean
}) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  })

  return {
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  }
}
