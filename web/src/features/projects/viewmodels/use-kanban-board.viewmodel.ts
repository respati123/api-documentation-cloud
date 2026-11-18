import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { KANBAN_BOARD_TEXT, SPRINT_BOARD_TEXT, statusTextKey } from '@/features/projects/constants/backlog-text.constants'
import { issuesService } from '@/features/projects/services/issues.service'
import { kanbanColumns } from '@/features/projects/utils/kanban-board'
import { boardMatches } from '@/features/projects/utils/sprint-board'
import { issueKeys } from '@/features/projects/viewmodels/issue-keys'
import { useBacklogData } from '@/features/projects/viewmodels/use-backlog-data'
import { boardCardOf } from '@/features/projects/viewmodels/use-sprint-board.viewmodel'
import { readErrorMessage } from '@/shared/utils/error-message'

type Text = (key: string, options?: Record<string, unknown>) => string

export interface KanbanAccess {
  canEdit: boolean
  // The PM and the tech lead set the limits.
  canApprove: boolean
}

// The Kanban board: the open items in a column for each status, with the limit of each column as a warning.
// A Kanban project has no sprints, so the items come from the ranked backlog.
export function useKanbanBoardViewModel(workspaceId: string, projectId: string | undefined, enabled: boolean, access: KanbanAccess) {
  const { t } = useTranslation('planning')
  const say = t as Text
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const userId = useAuthSessionStore((state) => state.userId)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [mine, setMine] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const project = projectId ?? ''
  const active = signedIn && enabled && Boolean(projectId)

  const backlog = useBacklogData(workspaceId, project, active)
  const limits = useQuery({
    queryKey: issueKeys.wipLimits(workspaceId, project),
    queryFn: () => issuesService.wipLimits(token, workspaceId, project),
    enabled: active,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: issueKeys.all(workspaceId, project) })
  const setStatus = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      issuesService.update(token, workspaceId, project, input.id, { status: input.status }),
    onMutate: () => setMoveError(null),
    onSuccess: refresh,
    onError: (error) => setMoveError(readErrorMessage(error, say(KANBAN_BOARD_TEXT.error))),
  })
  const saveLimit = useMutation({
    mutationFn: (limit: number | null) => issuesService.setWipLimit(token, workspaceId, project, editing ?? '', limit),
    onSuccess: async () => {
      setEditing(null)
      await refresh()
    },
  })

  const items = backlog.data?.pages.flatMap((page) => page.backlog.items) ?? []
  const filter = { search, mine }
  const parsed = Number(value)
  const valid = value.trim() !== '' && Number.isInteger(parsed) && parsed >= 1
  const failure = backlog.error ?? limits.error
  const loading = active && (backlog.isPending || limits.isPending)

  return {
    status: failure ? ('error' as const) : loading ? ('loading' as const) : ('ready' as const),
    error: failure ? readErrorMessage(failure, say(KANBAN_BOARD_TEXT.error)) : null,
    onRetry: () => void refresh(),
    columns: kanbanColumns(items, limits.data ?? []).map((column) => ({
      status: column.status,
      label: say(statusTextKey(column.status)),
      count: column.cards.length,
      limitLabel: column.limit === null ? String(column.cards.length) : `${column.cards.length} / ${column.limit}`,
      over: column.over,
      canSetLimit: access.canApprove,
      cards: column.cards.filter((card) => boardMatches(card, filter, userId)).map((card) => boardCardOf(card, say, access.canEdit)),
    })),
    hasMore: Boolean(backlog.hasNextPage),
    isLoadingMore: backlog.isFetchingNextPage,
    onLoadMore: () => void backlog.fetchNextPage(),
    filtering: search.trim() !== '' || mine,
    search,
    setSearch,
    mine,
    toggleMine: () => setMine((current) => !current),
    moveError,
    move: (id: string, status: string) => setStatus.mutate({ id, status }),
    limitDialog: {
      open: editing !== null,
      title: say(KANBAN_BOARD_TEXT.limitDialog.title, { status: editing ? say(statusTextKey(editing)) : '' }),
      value,
      setValue,
      canSubmit: valid && !saveLimit.isPending,
      isSaving: saveLimit.isPending,
      error: saveLimit.error ? readErrorMessage(saveLimit.error, say(SPRINT_BOARD_TEXT.error)) : null,
      onOpen: (status: string) => {
        saveLimit.reset()
        const current = (limits.data ?? []).find((row) => row.status === status)
        setValue(current ? String(current.limit) : '')
        setEditing(status)
      },
      onClose: () => setEditing(null),
      onSubmit: () => {
        if (valid) saveLimit.mutate(parsed)
      },
      onClear: () => saveLimit.mutate(null),
    },
  }
}
