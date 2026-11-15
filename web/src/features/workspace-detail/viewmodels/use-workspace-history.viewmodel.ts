import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { ACTIVITY_TEXT } from '@/features/workspace-detail/constants/activity-text.constants'
import type { CommitDayGroup, DiffLayout } from '@/features/workspace-detail/models/history.model'
import { workspaceDetailService } from '@/features/workspace-detail/services/workspace-detail.service'
import {
  buildChangeTree,
  buildFileDiffs,
  diffTotals,
  fileAnchorId,
  groupByDay,
  shortCommitId,
} from '@/features/workspace-detail/utils/commit-history'
import { readDiffLayout, writeDiffLayout } from '@/features/workspace-detail/utils/history-storage'
import { compareSnapshots } from '@/features/workspace-detail/utils/snapshot-diff'
import { workspaceDetailKeys } from '@/features/workspace-detail/viewmodels/workspace-detail.keys'
import { useWideScreen } from '@/shared/hooks/use-wide-screen'
import type { CloudCommit } from '@/shared/models/cloud-workspace.model'
import { readErrorMessage } from '@/shared/utils/error-message'
import { formatDate, formatRelativeDate } from '@/shared/utils/format'

export interface WorkspaceHistoryInput {
  workspaceId: string
  commits: CloudCommit[]
  enabled: boolean
  commitId: string | undefined
  canRestore: boolean
  onOpenCommit: (commitId: string) => void
  onOpenList: () => void
  onRestore: (commitId: string) => void
}

// What the reader has done inside one commit: items marked viewed, items folded, and hidden lines opened.
interface CommitUiState {
  commitId: string
  viewed: string[]
  collapsed: string[]
  expandedGaps: string[]
}

const toggle = (items: string[], value: string) => (items.includes(value) ? items.filter((item) => item !== value) : [...items, value])

export function useWorkspaceHistoryViewModel({
  workspaceId,
  commits,
  enabled,
  commitId,
  canRestore,
  onOpenCommit,
  onOpenList,
  onRestore,
}: WorkspaceHistoryInput) {
  const { t, i18n } = useTranslation()
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const [layout, setLayout] = useState<DiffLayout>(readDiffLayout)
  const wideScreen = useWideScreen()
  const [uiState, setUiState] = useState<CommitUiState>({ commitId: '', viewed: [], collapsed: [], expandedGaps: [] })
  const current: CommitUiState =
    uiState.commitId === commitId ? uiState : { commitId: commitId ?? '', viewed: [], collapsed: [], expandedGaps: [] }
  const update = (change: (state: CommitUiState) => CommitUiState) => setUiState(change(current))

  const latestCommitId = commits[0]?.id ?? ''
  const listed = commits.find((commit) => commit.id === commitId)
  const active = enabled && signedIn && Boolean(commitId)

  // A commit never changes after it is pushed, so its detail is fetched once.
  const commitQuery = useQuery({
    queryKey: workspaceDetailKeys.commit(token, workspaceId, commitId ?? ''),
    queryFn: () => workspaceDetailService.commitDetail(token, workspaceId, commitId ?? ''),
    enabled: active,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const parentId = commitQuery.data?.parentIds[0] ?? listed?.parentIds[0]
  const parentQuery = useQuery({
    queryKey: workspaceDetailKeys.commit(token, workspaceId, parentId ?? ''),
    queryFn: () => workspaceDetailService.commitDetail(token, workspaceId, parentId ?? ''),
    enabled: active && Boolean(commitQuery.data) && Boolean(parentId),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const failure = commitQuery.error ?? parentQuery.error
  const status: 'loading' | 'error' | 'ready' = failure
    ? 'error'
    : commitQuery.data && (!parentId || parentQuery.data)
      ? 'ready'
      : 'loading'
  const files =
    status === 'ready' && commitQuery.data ? buildFileDiffs(compareSnapshots(parentQuery.data?.tree ?? [], commitQuery.data.tree)) : []

  const dayGroups: CommitDayGroup[] = groupByDay(commits, (commit) => commit.createdAt).map((group) => ({
    key: group.key,
    label: formatDate(group.date, i18n.language) ?? '',
    commits: group.items.map((commit) => ({
      id: commit.id,
      shortId: shortCommitId(commit.id),
      message: commit.message,
      authorEmail: commit.authorEmail,
      when: formatRelativeDate(commit.createdAt, i18n.language) ?? '',
      isLatest: commit.id === latestCommitId,
    })),
  }))

  const detail = commitQuery.data
  const header = commitId
    ? {
        id: commitId,
        shortId: shortCommitId(commitId),
        message: detail?.message ?? listed?.message ?? '',
        authorEmail: detail?.authorEmail || listed?.authorEmail || '',
        when: formatRelativeDate(detail?.createdAt ?? listed?.createdAt ?? '', i18n.language) ?? '',
        date: formatDate(detail?.createdAt ?? listed?.createdAt ?? '', i18n.language) ?? '',
        parentId: parentId ?? null,
        parentShortId: parentId ? shortCommitId(parentId) : null,
        isLatest: commitId === latestCommitId,
      }
    : null

  return {
    mode: commitId ? ('detail' as const) : ('list' as const),
    dayGroups,
    commitCount: commits.length,
    onOpenCommit,
    commit: header,
    status,
    error: failure ? readErrorMessage(failure, t(ACTIVITY_TEXT.detail.errorFallback)) : null,
    retry: () => {
      void commitQuery.refetch()
      if (parentId) void parentQuery.refetch()
    },
    files,
    tree: buildChangeTree(files),
    totals: diffTotals(files),
    layout,
    // A narrow screen always reads the unified diff; the chosen layout comes back on a wider one.
    diffLayout: wideScreen ? layout : ('unified' as const),
    canChooseLayout: wideScreen,
    setLayout: (next: DiffLayout) => {
      setLayout(next)
      writeDiffLayout(next)
    },
    viewedIds: current.viewed,
    collapsedIds: current.collapsed,
    expandedGapKeys: current.expandedGaps,
    // Marking an item viewed folds it, like GitHub; clearing the mark opens it again.
    toggleViewed: (fileId: string) =>
      update((state) => {
        const viewed = toggle(state.viewed, fileId)
        const nowViewed = viewed.includes(fileId)
        const collapsed = nowViewed ? [...new Set([...state.collapsed, fileId])] : state.collapsed.filter((id) => id !== fileId)
        return { ...state, viewed, collapsed }
      }),
    toggleCollapsed: (fileId: string) => update((state) => ({ ...state, collapsed: toggle(state.collapsed, fileId) })),
    expandGap: (fileId: string, gapId: string) =>
      update((state) => ({ ...state, expandedGaps: [...new Set([...state.expandedGaps, `${fileId}:${gapId}`])] })),
    canRestore: canRestore && Boolean(commitId),
    onJumpToFile: (fileId: string) => {
      update((state) => ({ ...state, collapsed: state.collapsed.filter((id) => id !== fileId) }))
      document.getElementById(fileAnchorId(fileId))?.scrollIntoView({ block: 'start' })
    },
    onRestore: () => {
      if (commitId) onRestore(commitId)
    },
    onOpenList,
  }
}
