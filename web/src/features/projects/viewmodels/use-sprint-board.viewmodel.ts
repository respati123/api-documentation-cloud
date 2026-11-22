import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { BACKLOG_TEXT, SPRINT_BOARD_TEXT, statusTextKey } from '@/features/projects/constants/backlog-text.constants'
import { displayCode, type Issue, STORY_STATUSES, WORK_STATUSES } from '@/features/projects/models/issue.model'
import { issuesService } from '@/features/projects/services/issues.service'
import { daysLeft, sprintTotals } from '@/features/projects/utils/backlog'
import {
  BOARD_COLUMNS,
  boardMatches,
  epicLanes,
  itemLanes,
  type LANE_ROLES,
  type Lane,
  laneProgress,
  roleLanes,
  subtaskProgress,
} from '@/features/projects/utils/sprint-board'
import { issueKeys } from '@/features/projects/viewmodels/issue-keys'
import { useBacklogData } from '@/features/projects/viewmodels/use-backlog-data'
import { ARTIFACT_STANDARD_ENABLED } from '@/shared/config/features'
import { usePageList } from '@/shared/hooks/use-page-list'
import { readErrorMessage } from '@/shared/utils/error-message'
import { formatDate } from '@/shared/utils/format'

export type BoardGroup = 'item' | 'epic' | 'role'
type Text = (key: string, options?: Record<string, unknown>) => string

export interface BoardCard {
  id: string
  key: string
  // The ticket or feature code when there is one, else the key.
  code: string
  size: string | null
  // The sub-task line of an item shown as one card, such as Sub-tasks 2/5. Null when it has none.
  subtasks: string | null
  title: string
  typeLabel: string
  statusValue: string
  statusLabel: string
  statusOptions: Array<{ value: string; label: string }>
  assignee: string
  points: number | null
  canMove: boolean
}

export function boardCardOf(card: Issue, say: Text, canMove: boolean, progress?: { done: number; total: number }): BoardCard {
  return {
    id: card.id,
    key: card.key,
    code: ARTIFACT_STANDARD_ENABLED ? displayCode(card) : card.key,
    size: ARTIFACT_STANDARD_ENABLED ? (card.size ?? null) : null,
    subtasks: progress && progress.total > 0 ? say(SPRINT_BOARD_TEXT.subtasks, progress) : null,
    title: card.title,
    typeLabel: say(BACKLOG_TEXT.type[card.type]),
    statusValue: card.status ?? 'todo',
    statusLabel: say(statusTextKey(card.status ?? 'todo')),
    statusOptions: (card.type === 'story' ? STORY_STATUSES : WORK_STATUSES).map((value) => ({
      value,
      label: say(statusTextKey(value)),
    })),
    assignee: card.assigneeEmail?.split('@')[0] ?? say(BACKLOG_TEXT.unassigned),
    points: card.points,
    canMove,
  }
}

// The board of the active sprint. The sprint and its items come from the backlog data, which the Backlog tab shares.
// The sub-tasks of the whole project are paged in and kept for the items in the sprint.
export function useSprintBoardViewModel(workspaceId: string, projectId: string | undefined, enabled: boolean, canEdit: boolean) {
  const { t, i18n } = useTranslation('planning')
  const say = t as Text
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const userId = useAuthSessionStore((state) => state.userId)
  const queryClient = useQueryClient()
  const [group, setGroup] = useState<BoardGroup>('item')
  const [search, setSearch] = useState('')
  const [mine, setMine] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const project = projectId ?? ''
  const active = signedIn && enabled && Boolean(projectId)

  const backlog = useBacklogData(workspaceId, project, active)
  const sprint = backlog.data?.pages[0]?.sprints.find((item) => item.status === 'active')
  const subtasks = usePageList<Issue>({
    queryKey: issueKeys.subtasks(workspaceId, project),
    fetchPage: (cursor) => issuesService.subtasks(token, workspaceId, project, cursor),
    enabled: active && Boolean(sprint),
  })
  const epics = usePageList<Issue>({
    queryKey: issueKeys.epics(workspaceId, project),
    fetchPage: (cursor) => issuesService.epics(token, workspaceId, project, cursor),
    enabled: active && Boolean(sprint) && group === 'epic',
  })

  const setStatus = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      issuesService.update(token, workspaceId, project, input.id, { status: input.status }),
    onMutate: () => setMoveError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: issueKeys.all(workspaceId, project) }),
    onError: (error) => setMoveError(readErrorMessage(error, say(SPRINT_BOARD_TEXT.error))),
  })

  const items = sprint?.issues ?? []
  const filter = { search, mine }
  // In the epic and role lanes an item is one card, so its sub-tasks show as a progress line on it.
  const progressOf = subtaskProgress(subtasks.items)
  const toCard = (card: Issue) => boardCardOf(card, say, canEdit, group === 'item' ? undefined : progressOf.get(card.id))
  const toLane = (lane: Lane) => {
    const progress = laneProgress(lane)
    return {
      id: lane.id,
      lead: lane.lead
        ? {
            key: ARTIFACT_STANDARD_ENABLED ? displayCode(lane.lead) : lane.lead.key,
            title: lane.lead.title,
            typeLabel: say(BACKLOG_TEXT.type[lane.lead.type]),
          }
        : null,
      title:
        lane.role !== undefined
          ? say(SPRINT_BOARD_TEXT.role[(lane.role ?? 'none') as (typeof LANE_ROLES)[number] | 'none'])
          : (lane.lead?.title ?? say(BACKLOG_TEXT.noEpic)),
      progress: say(SPRINT_BOARD_TEXT.laneProgress, progress),
      percent: progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100),
      columns: BOARD_COLUMNS.map((column) => ({
        id: column,
        label: say(SPRINT_BOARD_TEXT.columns[column]),
        cards: lane.columns[column].filter((card) => boardMatches(card, filter, userId)).map(toCard),
      })),
    }
  }
  const lanes = (group === 'epic' ? epicLanes(items, epics.items) : group === 'role' ? roleLanes(items) : itemLanes(items, subtasks.items))
    .map(toLane)
    .filter((lane) => lane.columns.some((column) => column.cards.length > 0))
  const filtering = search.trim() !== '' || mine
  const totals = sprintTotals(items)
  const left = sprint ? daysLeft(sprint.endsOn, new Date()) : 0
  const failure = backlog.error ?? subtasks.error ?? epics.error
  const loading = active && (backlog.isPending || (Boolean(sprint) && (subtasks.isPending || (group === 'epic' && epics.isPending))))

  return {
    status: failure ? ('error' as const) : loading ? ('loading' as const) : ('ready' as const),
    error: failure ? readErrorMessage(failure, say(SPRINT_BOARD_TEXT.error)) : null,
    onRetry: () => void queryClient.invalidateQueries({ queryKey: issueKeys.all(workspaceId, project) }),
    sprint: sprint
      ? {
          name: sprint.name,
          goal: sprint.goal || say(BACKLOG_TEXT.sprint.noGoal),
          dates: say(BACKLOG_TEXT.sprint.dates, {
            from: formatDate(sprint.startsOn, i18n.language) ?? sprint.startsOn,
            to: formatDate(sprint.endsOn, i18n.language) ?? sprint.endsOn,
          }),
          daysLeft: say(BACKLOG_TEXT.sprint.daysLeft, { count: left }),
          totals: say(BACKLOG_TEXT.sprint.doneTotals, { ...totals }),
        }
      : null,
    filtering,
    group,
    setGroup: (value: string) => setGroup(value === 'epic' ? 'epic' : value === 'role' && ARTIFACT_STANDARD_ENABLED ? 'role' : 'item'),
    groupOptions: [
      { value: 'item', label: say(SPRINT_BOARD_TEXT.groupItem) },
      { value: 'epic', label: say(SPRINT_BOARD_TEXT.groupEpic) },
      ...(ARTIFACT_STANDARD_ENABLED ? [{ value: 'role', label: say(SPRINT_BOARD_TEXT.groupRole) }] : []),
    ],
    search,
    setSearch,
    mine,
    toggleMine: () => setMine((value) => !value),
    lanes,
    moveError,
    move: (id: string, status: string) => setStatus.mutate({ id, status }),
  }
}
