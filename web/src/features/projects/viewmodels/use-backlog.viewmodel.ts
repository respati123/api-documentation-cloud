import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { BACKLOG_TEXT, MODE_TEXT, statusTextKey } from '@/features/projects/constants/backlog-text.constants'
import { displayCode, type Issue, type IssueType, type StatusCategory, statusCategory } from '@/features/projects/models/issue.model'
import { issuesService } from '@/features/projects/services/issues.service'
import { daysLeft, epicCounts, filterByEpic, type ReadyGap, readyGaps, sprintTotals } from '@/features/projects/utils/backlog'
import { issueKeys } from '@/features/projects/viewmodels/issue-keys'
import { BACKLOG_GROUP, type BacklogAccess, useBacklogActionsViewModel } from '@/features/projects/viewmodels/use-backlog-actions.viewmodel'
import { useBacklogData } from '@/features/projects/viewmodels/use-backlog-data'
import { useBacklogDrag } from '@/features/projects/viewmodels/use-backlog-drag'
import { ARTIFACT_STANDARD_ENABLED } from '@/shared/config/features'
import { usePageList } from '@/shared/hooks/use-page-list'
import { readErrorMessage } from '@/shared/utils/error-message'
import { formatDate } from '@/shared/utils/format'

export interface BacklogRow {
  id: string
  key: string
  title: string
  type: IssueType
  typeLabel: string
  statusLabel: string
  category: StatusCategory
  points: number | null
  pointsLabel: string
  epicKey: string | null
  assignee: string
  gaps: Array<{ id: ReadyGap; label: string }>
  ready: boolean
  isDraft: boolean
  outdated: boolean
  pointsValue: string
  canSetPoints: boolean
  canPublish: boolean
}

type Text = (key: string, options?: Record<string, unknown>) => string

// The backlog screen: the open sprints with their items, then the items that belong to no sprint, and an epic filter.
// The sprints come with the first page of the backlog. Only the loose items and the epics page on.
const NO_ACCESS: BacklogAccess = { canEdit: false, canApprove: false, canManage: false }

export function useBacklogViewModel(
  workspaceId: string,
  projectId: string | undefined,
  productGoal: string,
  enabled: boolean,
  access: BacklogAccess = NO_ACCESS,
  mode: 'scrum' | 'kanban' = 'scrum',
) {
  const { t, i18n } = useTranslation('planning')
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const [epicFilter, setEpicFilter] = useState('')
  const active = signedIn && enabled && Boolean(projectId)
  const project = projectId ?? ''

  const backlog = useBacklogData(workspaceId, project, active)
  const epics = usePageList<Issue>({
    queryKey: issueKeys.epics(workspaceId, project),
    fetchPage: (cursor) => issuesService.epics(token, workspaceId, project, cursor),
    enabled: active,
  })

  const sprintList = backlog.data?.pages[0]?.sprints ?? []
  const looseItems = backlog.data?.pages.flatMap((page) => page.backlog.items) ?? []
  const actions = useBacklogActionsViewModel({
    workspaceId,
    projectId,
    access,
    epics: epics.items.map((epic) => ({ id: epic.id, title: epic.title })),
    openSprints: sprintList.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      status: sprint.status === 'active' ? 'active' : 'planned',
      goal: sprint.goal,
      startsOn: sprint.startsOn,
      endsOn: sprint.endsOn,
    })),
    productGoal,
  })
  const epicKeyOf = new Map(epics.items.map((epic) => [epic.id, ARTIFACT_STANDARD_ENABLED ? displayCode(epic) : epic.key]))
  const everything = [...sprintList.flatMap((sprint) => sprint.issues), ...looseItems]
  const counts = epicCounts(epics.items, everything)
  const toRow = (issue: Issue) => rowOf(issue, t as Text, epicKeyOf, access)
  const shownLoose = filterByEpic(looseItems, epicFilter)
  const today = new Date()
  const failure = backlog.error ?? epics.error

  // The rows of every list by id, and the order each list has on the server. A drag reorders the lists on screen first.
  const shownIn = (issues: Issue[]) => filterByEpic(issues, epicFilter)
  const rowById = new Map(
    [...sprintList.flatMap((sprint) => shownIn(sprint.issues)), ...shownLoose].map((issue) => [issue.id, toRow(issue)]),
  )
  const drag = useBacklogDrag(
    {
      [BACKLOG_GROUP]: shownLoose.map((issue) => issue.id),
      ...Object.fromEntries(sprintList.map((sprint) => [sprint.id, shownIn(sprint.issues).map((issue) => issue.id)])),
    },
    (drop) => actions.drop({ ...drop, title: rowById.get(drop.issueId)?.title ?? '' }),
    actions.rankEnabled && epicFilter === '',
  )
  const rowsOf = (group: string) => (drag.lists[group] ?? []).flatMap((id) => rowById.get(id) ?? [])

  return {
    status: backlog.isPending && active ? ('loading' as const) : failure ? ('error' as const) : ('ready' as const),
    error: failure ? readErrorMessage(failure, t(BACKLOG_TEXT.error)) : null,
    onRetry: () => void backlog.refetch(),
    productGoal,
    actions,
    drag: { onDragEnd: drag.onDragEnd },
    canCreate: access.canEdit,
    canPlan: access.canApprove,
    sprintsEnabled: mode === 'scrum',
    mode,
    canSwitchMode: access.canManage,
    modeOptions: [
      { value: 'scrum', label: t(MODE_TEXT.scrum) },
      { value: 'kanban', label: t(MODE_TEXT.kanban) },
    ],
    canEditGoal: access.canManage,
    rankEnabled: actions.rankEnabled && epicFilter === '',
    epics: {
      items: epics.items.map((epic) => ({
        id: epic.id,
        key: ARTIFACT_STANDARD_ENABLED ? displayCode(epic) : epic.key,
        title: epic.title,
        count: counts.byEpic[epic.id] ?? 0,
        selected: epicFilter === epic.id,
      })),
      withoutEpic: counts.withoutEpic,
      total: everything.length,
      selected: epicFilter,
      hasMore: epics.hasMore,
      isLoadingMore: epics.isLoadingMore,
      onLoadMore: epics.loadMore,
      onSelect: (id: string) => setEpicFilter((current) => (current === id ? '' : id)),
    },
    sprints: sprintList.map((sprint) => {
      const totals = sprintTotals(sprint.issues)
      return {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal || t(BACKLOG_TEXT.sprint.noGoal),
        isActive: sprint.status === 'active',
        canStart: actions.canStartSprint && sprint.status === 'planned',
        canClose: access.canApprove && sprint.status === 'active',
        canEdit: access.canApprove,
        statusLabel: t(sprint.status === 'active' ? BACKLOG_TEXT.sprint.active : BACKLOG_TEXT.sprint.planned),
        dates: t(BACKLOG_TEXT.sprint.dates, {
          from: formatDate(sprint.startsOn, i18n.language) ?? sprint.startsOn,
          to: formatDate(sprint.endsOn, i18n.language) ?? sprint.endsOn,
        }),
        daysLeft: sprint.status === 'active' ? t(BACKLOG_TEXT.sprint.daysLeft, { count: daysLeft(sprint.endsOn, today) }) : null,
        totals: t(BACKLOG_TEXT.sprint.totals, { items: totals.items, points: totals.points }),
        progress: totals.items > 0 ? t(BACKLOG_TEXT.sprint.doneTotals, { done: totals.done, donePoints: totals.donePoints }) : null,
        rows: rowsOf(sprint.id),
        emptyLabel: t(BACKLOG_TEXT.sprint.empty),
      }
    }),
    backlog: {
      rows: rowsOf(BACKLOG_GROUP),
      count: t(BACKLOG_TEXT.section.count, { count: shownLoose.length }),
      emptyLabel: t(epicFilter === '' ? BACKLOG_TEXT.section.empty : BACKLOG_TEXT.section.emptyFiltered),
      hasMore: Boolean(backlog.hasNextPage),
      isLoadingMore: backlog.isFetchingNextPage,
      onLoadMore: () => void backlog.fetchNextPage(),
    },
  }
}

function rowOf(issue: Issue, t: Text, epicKeyOf: Map<string, string>, access: BacklogAccess): BacklogRow {
  const gaps = readyGaps(issue)
  return {
    id: issue.id,
    key: ARTIFACT_STANDARD_ENABLED ? displayCode(issue) : issue.key,
    title: issue.title,
    type: issue.type,
    typeLabel: t(BACKLOG_TEXT.type[issue.type]),
    statusLabel: issue.status ? t(statusTextKey(issue.status)) : '',
    category: statusCategory(issue.status),
    points: issue.points,
    pointsLabel: issue.points === null ? t(BACKLOG_TEXT.noPoints) : t(BACKLOG_TEXT.points, { count: issue.points }),
    epicKey: issue.parentId ? (epicKeyOf.get(issue.parentId) ?? null) : null,
    assignee: issue.assigneeEmail?.split('@')[0] ?? t(BACKLOG_TEXT.unassigned),
    gaps: gaps.map((gap) => ({ id: gap, label: t(BACKLOG_TEXT.gap[gap]) })),
    ready: gaps.length === 0,
    isDraft: issue.publishedAt === null,
    outdated: issue.sourceOutdated === true,
    pointsValue: issue.points === null ? '' : String(issue.points),
    canSetPoints: access.canEdit && issue.type !== 'epic',
    canPublish: access.canApprove && issue.publishedAt === null,
  }
}
