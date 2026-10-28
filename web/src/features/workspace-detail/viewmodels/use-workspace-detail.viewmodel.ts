import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { useWorkspacesQuery } from '@/features/workspaces'
import type { ApiNode } from '@/shared/models/cloud-workspace.model'
import { ApiError } from '@/shared/services/api-client'
import { WORKSPACE_TEXT } from '../constants/workspace-detail-text.constants'
import { workspaceDetailService } from '../services/workspace-detail.service'
import { countFolders, countRequests, filterCollection, findRequest, firstRequest } from '../utils/collection'
import { workspaceDetailKeys } from './workspace-detail.keys'

const EMPTY_TREE: ApiNode[] = []

export function useWorkspaceDetailViewModel(workspaceId: string) {
  const { t } = useTranslation('workspace')
  const token = useAuthSessionStore((state) => state.token)
  const userId = useAuthSessionStore((state) => state.userId)
  const workspacesQuery = useWorkspacesQuery(token)
  const workspace = workspacesQuery.data?.find((item) => item.id === workspaceId) ?? null
  const isOwner = workspace?.role === 'owner'

  const detailQuery = useQuery({
    queryKey: workspaceDetailKeys.detail(token, workspaceId),
    queryFn: () => workspaceDetailService.detail(token, workspaceId),
    enabled: token !== '' && workspaceId !== '',
    staleTime: 30_000,
  })

  const [query, setQuery] = useState('')
  const [chosenRequestId, setChosenRequestId] = useState('')
  const snapshot = detailQuery.data?.snapshot ?? null
  const tree = snapshot?.tree ?? EMPTY_TREE
  const visibleTree = useMemo(() => filterCollection(tree, query), [tree, query])
  const selectedRequest = findRequest(visibleTree, chosenRequestId) ?? firstRequest(visibleTree)
  const counts = useMemo(() => ({ requests: countRequests(tree), folders: countFolders(tree) }), [tree])

  const detailStatus = detailQuery.isPending ? 'loading' : detailQuery.isError ? 'error' : snapshot ? 'ready' : 'unavailable'
  const detailError = detailQuery.error
    ? detailQuery.error instanceof ApiError
      ? detailQuery.error.message
      : t(WORKSPACE_TEXT.state.loadFailed)
    : null

  return {
    token,
    userId,
    workspace,
    isOwner,
    workspacesLoading: workspacesQuery.isPending,
    detailStatus,
    detailError,
    refetchDetail: () => void detailQuery.refetch(),
    snapshot,
    commits: detailQuery.data?.commits ?? [],
    members: detailQuery.data?.members ?? [],
    tree: visibleTree,
    query,
    setQuery,
    counts,
    selectedRequest,
    selectRequest: setChosenRequestId,
  }
}
