import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { TIMELINE_TEXT } from '@/features/projects/constants/timeline-text.constants'
import { displayCode, type Issue } from '@/features/projects/models/issue.model'
import { issuesService } from '@/features/projects/services/issues.service'
import { type TimelineBar, timelineColumns, timelineRows } from '@/features/projects/utils/timeline'
import { issueKeys } from '@/features/projects/viewmodels/issue-keys'
import { usePageList } from '@/shared/hooks/use-page-list'
import { readErrorMessage } from '@/shared/utils/error-message'
import { formatDate } from '@/shared/utils/format'

type Text = (key: string, options?: Record<string, unknown>) => string

// Where a bar sits across the sprint columns, as percentages, so the view only applies them.
function spanOf(bar: Pick<TimelineBar, 'from' | 'to'>, columns: number) {
  if (bar.from === null || bar.to === null || columns === 0) return null
  return { left: `${(bar.from / columns) * 100}%`, width: `${((bar.to - bar.from + 1) / columns) * 100}%` }
}

// The timeline: one row per epic across the sprints, open to see where each of its tickets sits.
export function useTimelineViewModel(workspaceId: string, projectId: string | undefined, enabled: boolean) {
  const { t, i18n } = useTranslation('planning')
  const say = t as Text
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const project = projectId ?? ''
  const active = signedIn && enabled && Boolean(projectId)

  const sprints = useQuery({
    queryKey: issueKeys.sprints(workspaceId, project),
    queryFn: () => issuesService.sprints(token, workspaceId, project),
    enabled: active,
  })
  const epics = usePageList<Issue>({
    queryKey: issueKeys.epics(workspaceId, project),
    fetchPage: (cursor) => issuesService.epics(token, workspaceId, project, cursor),
    enabled: active,
  })
  const tasks = usePageList<Issue>({
    queryKey: issueKeys.tasks(workspaceId, project),
    fetchPage: (cursor) => issuesService.tasks(token, workspaceId, project, cursor),
    enabled: active,
  })

  const columns = timelineColumns(sprints.data ?? [])
  const rows = timelineRows(epics.items, tasks.items, columns, displayCode)
  const failure = sprints.error ?? epics.error ?? tasks.error
  const loading = active && (sprints.isPending || epics.isPending || tasks.isPending)
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const date = (value: string) => formatDate(value, i18n.language) ?? value

  return {
    status: failure ? ('error' as const) : loading ? ('loading' as const) : ('ready' as const),
    error: failure ? readErrorMessage(failure, say(TIMELINE_TEXT.error)) : null,
    onRetry: () => void queryClient.invalidateQueries({ queryKey: issueKeys.all(workspaceId, project) }),
    columns: columns.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      dates: `${date(sprint.startsOn)} – ${date(sprint.endsOn)}`,
      active: sprint.status === 'active',
    })),
    rows: rows.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      category: row.category,
      categoryLabel: say(TIMELINE_TEXT.category[row.category]),
      progress: say(TIMELINE_TEXT.progress, { done: row.done, total: row.total }),
      span: spanOf(row, columns.length),
      open: open.has(row.id),
      toggleLabel: say(open.has(row.id) ? TIMELINE_TEXT.collapse : TIMELINE_TEXT.expand, { code: row.code }),
      onToggle: () => toggle(row.id),
      items: row.items.map((item) => ({
        id: item.id,
        code: item.code,
        title: item.title,
        category: item.category,
        categoryLabel: say(TIMELINE_TEXT.category[item.category]),
        span: spanOf(item, columns.length),
      })),
    })),
    more: {
      hasMore: Boolean(tasks.hasMore || epics.hasMore),
      isLoadingMore: tasks.isLoadingMore || epics.isLoadingMore,
      onLoadMore: () => {
        if (tasks.hasMore) tasks.loadMore()
        if (epics.hasMore) epics.loadMore()
      },
    },
  }
}
