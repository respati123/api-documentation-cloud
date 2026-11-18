import { useInfiniteQuery } from '@tanstack/react-query'
import { useAuthSessionStore } from '@/features/auth'
import { issuesService } from '@/features/projects/services/issues.service'
import { issueKeys } from '@/features/projects/viewmodels/issue-keys'

// The open sprints and the loose backlog items, paged by cursor. The Backlog tab, the board, and the overview read the same
// query key, so the data loads once and every screen sees a change at the same time.
export function useBacklogData(workspaceId: string, projectId: string, active: boolean) {
  const token = useAuthSessionStore((state) => state.token)
  return useInfiniteQuery({
    queryKey: issueKeys.backlog(workspaceId, projectId),
    queryFn: ({ pageParam }) => issuesService.backlog(token, workspaceId, projectId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.backlog.nextCursor,
    enabled: active,
    staleTime: 10_000,
  })
}
