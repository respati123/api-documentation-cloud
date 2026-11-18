import { useTranslation } from 'react-i18next'
import { BACKLOG_TEXT, SPRINT_OVERVIEW_TEXT } from '@/features/projects/constants/backlog-text.constants'
import { daysLeft, sprintTotals } from '@/features/projects/utils/backlog'
import { useBacklogData } from '@/features/projects/viewmodels/use-backlog-data'
import { readErrorMessage } from '@/shared/utils/error-message'

type Text = (key: string, options?: Record<string, unknown>) => string

// The active sprint in a few numbers, for the overview: its goal, the days left, and the points done against the committed.
export function useSprintSummaryViewModel(workspaceId: string, projectId: string | undefined, enabled: boolean) {
  const { t } = useTranslation('planning')
  const say = t as Text
  const backlog = useBacklogData(workspaceId, projectId ?? '', enabled && Boolean(projectId))
  const sprint = backlog.data?.pages[0]?.sprints.find((item) => item.status === 'active')
  const totals = sprintTotals(sprint?.issues ?? [])

  return {
    status: backlog.isError ? ('error' as const) : enabled && backlog.isPending ? ('loading' as const) : ('ready' as const),
    error: backlog.error ? readErrorMessage(backlog.error, say(SPRINT_OVERVIEW_TEXT.error)) : null,
    sprint: sprint
      ? {
          name: sprint.name,
          goal: sprint.goal || say(BACKLOG_TEXT.sprint.noGoal),
          daysLeft: say(BACKLOG_TEXT.sprint.daysLeft, { count: daysLeft(sprint.endsOn, new Date()) }),
          committed: totals.points,
          done: totals.donePoints,
          percent: totals.points === 0 ? 0 : Math.round((totals.donePoints / totals.points) * 100),
          items: say(SPRINT_OVERVIEW_TEXT.itemsDone, { done: totals.done, total: totals.items }),
          points: say(SPRINT_OVERVIEW_TEXT.points, { done: totals.donePoints, committed: totals.points }),
        }
      : null,
  }
}
