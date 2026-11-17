import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { BACKLOG_TEXT } from '@/features/projects/constants/backlog-text.constants'
import { type Issue, type IssueType, type StatusCategory, statusCategory } from '@/features/projects/models/issue.model'
import { issuesService } from '@/features/projects/services/issues.service'
import { daysLeft, epicCounts, filterByEpic, type ReadyGap, readyGaps, sprintTotals } from '@/features/projects/utils/backlog'
import { issueKeys } from '@/features/projects/viewmodels/issue-keys'
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
}

type Text = (key: string, options?: Record<string, unknown>) => string

// The backlog screen: the open sprints with their items, then the items that belong to no sprint, and an epic filter.
// The sprints come with the first page of the backlog. Only the loose items and the epics page on.
export function useBacklogViewModel(workspaceId: string, projectId: string | undefined, productGoal: string, enabled: boolean) {
  const { t, i18n } = useTranslation('planning')
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const [epicFilter, setEpicFilter] = useState('')
  const active = signedIn && enabled && Boolean(projectId)
  const project = projectId ?? ''

  const backlog = useInfiniteQuery({
    queryKey: issueKeys.backlog(workspaceId, project),
    queryFn: ({ pageParam }) => issuesService.backlog(token, workspaceId, project, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.backlog.nextCursor,
    enabled: active,
    staleTime: 10_000,
  })
  const epics = usePageList<Issue>({
    queryKey: issueKeys.epics(workspaceId, project),
    fetchPage: (cursor) => issuesService.epics(token, workspaceId, project, cursor),
    enabled: active,
  })

  const sprintList = backlog.data?.pages[0]?.sprints ?? []
  const looseItems = backlog.data?.pages.flatMap((page) => page.backlog.items) ?? []
  const epicKeyOf = new Map(epics.items.map((epic) => [epic.id, epic.key]))
  const everything = [...sprintList.flatMap((sprint) => sprint.issues), ...looseItems]
  const counts = epicCounts(epics.items, everything)
  const toRow = (issue: Issue) => rowOf(issue, t as Text, epicKeyOf)
  const shownLoose = filterByEpic(looseItems, epicFilter)
  const today = new Date()
  const failure = backlog.error ?? epics.error

  return {
    status: backlog.isPending && active ? ('loading' as const) : failure ? ('error' as const) : ('ready' as const),
    error: failure ? readErrorMessage(failure, t(BACKLOG_TEXT.error)) : null,
    onRetry: () => void backlog.refetch(),
    productGoal,
    epics: {
      items: epics.items.map((epic) => ({
        id: epic.id,
        key: epic.key,
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
      const items = filterByEpic(sprint.issues, epicFilter)
      const totals = sprintTotals(sprint.issues)
      return {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal || t(BACKLOG_TEXT.sprint.noGoal),
        isActive: sprint.status === 'active',
        statusLabel: t(sprint.status === 'active' ? BACKLOG_TEXT.sprint.active : BACKLOG_TEXT.sprint.planned),
        dates: t(BACKLOG_TEXT.sprint.dates, {
          from: formatDate(sprint.startsOn, i18n.language) ?? sprint.startsOn,
          to: formatDate(sprint.endsOn, i18n.language) ?? sprint.endsOn,
        }),
        daysLeft: sprint.status === 'active' ? t(BACKLOG_TEXT.sprint.daysLeft, { count: daysLeft(sprint.endsOn, today) }) : null,
        totals: t(BACKLOG_TEXT.sprint.totals, { items: totals.items, points: totals.points }),
        progress: totals.items > 0 ? t(BACKLOG_TEXT.sprint.doneTotals, { done: totals.done, donePoints: totals.donePoints }) : null,
        rows: items.map(toRow),
        emptyLabel: t(BACKLOG_TEXT.sprint.empty),
      }
    }),
    backlog: {
      rows: shownLoose.map(toRow),
      count: t(BACKLOG_TEXT.section.count, { count: shownLoose.length }),
      emptyLabel: t(epicFilter === '' ? BACKLOG_TEXT.section.empty : BACKLOG_TEXT.section.emptyFiltered),
      hasMore: Boolean(backlog.hasNextPage),
      isLoadingMore: backlog.isFetchingNextPage,
      onLoadMore: () => void backlog.fetchNextPage(),
    },
  }
}

function rowOf(issue: Issue, t: Text, epicKeyOf: Map<string, string>): BacklogRow {
  const gaps = readyGaps(issue)
  return {
    id: issue.id,
    key: issue.key,
    title: issue.title,
    type: issue.type,
    typeLabel: t(BACKLOG_TEXT.type[issue.type]),
    statusLabel: issue.status ? t(statusKey(issue.status)) : '',
    category: statusCategory(issue.status),
    points: issue.points,
    pointsLabel: issue.points === null ? t(BACKLOG_TEXT.noPoints) : t(BACKLOG_TEXT.points, { count: issue.points }),
    epicKey: issue.parentId ? (epicKeyOf.get(issue.parentId) ?? null) : null,
    assignee: issue.assigneeEmail?.split('@')[0] ?? t(BACKLOG_TEXT.unassigned),
    gaps: gaps.map((gap) => ({ id: gap, label: t(BACKLOG_TEXT.gap[gap]) })),
    ready: gaps.length === 0,
    isDraft: issue.publishedAt === null,
    outdated: issue.sourceOutdated === true,
  }
}

// A status the server sends that this page has no word for shows as To do rather than as a raw key.
const statusKey = (status: string): string =>
  status in BACKLOG_TEXT.status ? BACKLOG_TEXT.status[status as keyof typeof BACKLOG_TEXT.status] : BACKLOG_TEXT.status.todo
