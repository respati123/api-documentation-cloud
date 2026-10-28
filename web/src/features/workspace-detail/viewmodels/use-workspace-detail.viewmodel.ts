import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorkspaceTab } from '@/features/app-shell'
import { useAuthSessionStore } from '@/features/auth'
import type { ApiNode } from '@/shared/models/cloud-workspace.model'
import { ApiError } from '@/shared/services/api-client'
import { WORKSPACE_TEXT } from '../constants/workspace-detail-text.constants'
import { workspaceDetailService } from '../services/workspace-detail.service'
import { countFolders, countRequests, filterCollection, findRequest, firstRequest } from '../utils/collection'
import { useWorkspaceHistoryList, useWorkspaceMembersList } from './use-workspace-lists.viewmodel'
import { workspaceDetailKeys } from './workspace-detail.keys'

const EMPTY_TREE: ApiNode[] = []

// The snapshot is loaded for every tab. History and members load only on the tabs that show them.
export function useWorkspaceDetailViewModel(workspaceId: string, tab: WorkspaceTab) {
  const { t } = useTranslation('workspace')
  const token = useAuthSessionStore((state) => state.token)
  const userId = useAuthSessionStore((state) => state.userId)
  const snapshotQuery = useQuery({
    queryKey: workspaceDetailKeys.detail(token, workspaceId),
    queryFn: () => workspaceDetailService.pull(token, workspaceId),
    enabled: token !== '' && workspaceId !== '',
    staleTime: 30_000,
  })
  const history = useWorkspaceHistoryList(workspaceId, tab === 'overview' || tab === 'activity')
  const members = useWorkspaceMembersList(workspaceId, tab === 'team')

  const [query, setQuery] = useState('')
  const [chosenRequestId, setChosenRequestId] = useState('')
  const snapshot = snapshotQuery.data ?? null
  // The snapshot carries the workspace name and the caller's role, so the page does not depend on which list pages are loaded.
  const workspace = snapshot
  const isOwner = snapshot?.role === 'owner'
  const tree = snapshot?.tree ?? EMPTY_TREE
  const visibleTree = useMemo(() => filterCollection(tree, query), [tree, query])
  const selectedRequest = findRequest(visibleTree, chosenRequestId) ?? firstRequest(visibleTree)
  const counts = useMemo(() => ({ requests: countRequests(tree), folders: countFolders(tree) }), [tree])

  const detailStatus = snapshotQuery.isPending ? 'loading' : snapshotQuery.isError ? 'error' : snapshot ? 'ready' : 'unavailable'
  const detailError = snapshotQuery.error
    ? snapshotQuery.error instanceof ApiError
      ? snapshotQuery.error.message
      : t(WORKSPACE_TEXT.state.loadFailed)
    : null

  return {
    token,
    userId,
    workspace,
    isOwner,
    detailStatus,
    detailError,
    refetchDetail: () => void snapshotQuery.refetch(),
    snapshot,
    commits: history.items,
    commitsHasMore: history.hasMore,
    commitsLoadingMore: history.isLoadingMore,
    loadMoreCommits: history.loadMore,
    members: members.items,
    membersHasMore: members.hasMore,
    membersLoadingMore: members.isLoadingMore,
    loadMoreMembers: members.loadMore,
    membersError: members.error,
    tree: visibleTree,
    query,
    setQuery,
    counts,
    selectedRequest,
    selectRequest: setChosenRequestId,
  }
}
