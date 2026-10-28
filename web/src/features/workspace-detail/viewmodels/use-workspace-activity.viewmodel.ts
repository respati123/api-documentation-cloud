import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import type { ApiNode, CloudCommit } from '@/shared/models/cloud-workspace.model'
import { readErrorMessage } from '@/shared/utils/error-message'
import { ACTIVITY_TEXT } from '../constants/activity-text.constants'
import { workspaceDetailService } from '../services/workspace-detail.service'
import { compareSnapshots, type SnapshotChange } from '../utils/snapshot-diff'
import { workspaceDetailKeys } from './workspace-detail.keys'

export function useWorkspaceActivityViewModel(workspaceId: string, commits: CloudCommit[], enabled: boolean) {
  const { t } = useTranslation()
  const token = useAuthSessionStore((state) => state.token)
  const [chosenCommitId, setChosenCommitId] = useState('')
  const [chosenChangeId, setChosenChangeId] = useState('')
  const selectedCommit = commits.find((commit) => commit.id === chosenCommitId) ?? commits[0] ?? null
  const parentId = selectedCommit?.parentIds[0]
  const active = enabled && token !== '' && selectedCommit !== null

  const currentQuery = useQuery({
    queryKey: workspaceDetailKeys.commit(token, workspaceId, selectedCommit?.id ?? ''),
    queryFn: () => workspaceDetailService.commitTree(token, workspaceId, selectedCommit?.id ?? ''),
    enabled: active,
  })
  const parentQuery = useQuery({
    queryKey: workspaceDetailKeys.commit(token, workspaceId, parentId ?? ''),
    queryFn: () => workspaceDetailService.commitTree(token, workspaceId, parentId ?? ''),
    enabled: active && Boolean(parentId),
  })

  const loading = active && (currentQuery.isPending || (Boolean(parentId) && parentQuery.isPending))
  const failure = currentQuery.error ?? parentQuery.error
  const error = failure ? readErrorMessage(failure, t(ACTIVITY_TEXT.detail.errorFallback)) : null
  const changes: SnapshotChange[] = useMemo(() => {
    if (!active || loading || error || !currentQuery.data) return []
    const before: ApiNode[] = parentId ? (parentQuery.data ?? []) : []
    return compareSnapshots(before, currentQuery.data)
  }, [active, loading, error, currentQuery.data, parentQuery.data, parentId])
  const activeChange = changes.find((change) => change.id === chosenChangeId) ?? changes[0] ?? null

  return {
    selectedCommit,
    latestCommitId: commits[0]?.id ?? '',
    selectCommit: (commitId: string) => {
      setChosenCommitId(commitId)
      setChosenChangeId('')
    },
    loading,
    error,
    changes,
    activeChange,
    selectChange: setChosenChangeId,
  }
}
