import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { statusTextKey } from '@/features/projects/constants/backlog-text.constants'
import { REPORTS_TEXT } from '@/features/projects/constants/reports-text.constants'
import type { ReportItem, Sprint } from '@/features/projects/models/issue.model'
import { issuesService } from '@/features/projects/services/issues.service'
import { issueKeys } from '@/features/projects/viewmodels/issue-keys'
import { readErrorMessage } from '@/shared/utils/error-message'
import { formatShortDate } from '@/shared/utils/format'

export const FLOW_PERIODS = [14, 30, 60, 90] as const
export type ProjectMode = 'scrum' | 'kanban'

type Text = (key: string, options?: Record<string, unknown>) => string

export interface ReportRow {
  id: string
  key: string
  title: string
  detail: string
}

// Sprints that have started are the ones with something to report. The running one comes first, then the latest closed.
export function reportableSprints(sprints: Sprint[]): Sprint[] {
  return sprints
    .filter((sprint) => sprint.status !== 'planned')
    .sort((a, b) => (a.status === b.status ? b.startsOn.localeCompare(a.startsOn) : a.status === 'active' ? -1 : 1))
}

// The reports tab. A Scrum project shows the burndown, the report, and the velocity of a sprint. A Kanban project shows
// work in progress against its limits, throughput, cycle time, the age of open items, and the cumulative flow.
export function useReportsViewModel(workspaceId: string, projectId: string | undefined, mode: ProjectMode, enabled: boolean) {
  const { t, i18n } = useTranslation('planning')
  const say = t as Text
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const [sprintChoice, setSprintChoice] = useState('')
  const [days, setDays] = useState<number>(30)
  const project = projectId ?? ''
  const active = signedIn && enabled && Boolean(projectId)
  const scrum = mode === 'scrum'
  const lang = i18n.language
  const date = (value: string) => formatShortDate(value, lang)

  const sprints = useQuery({
    queryKey: issueKeys.sprints(workspaceId, project),
    queryFn: () => issuesService.sprints(token, workspaceId, project),
    enabled: active && scrum,
    staleTime: 15_000,
  })
  const options = reportableSprints(sprints.data ?? [])
  const sprint = options.find((item) => item.id === sprintChoice) ?? options[0]
  const sprintId = sprint?.id ?? ''

  const burndown = useQuery({
    queryKey: [...issueKeys.reports(workspaceId, project), 'burndown', sprintId],
    queryFn: () => issuesService.burndown(token, workspaceId, project, sprintId),
    enabled: active && scrum && Boolean(sprintId),
    staleTime: 15_000,
  })
  const report = useQuery({
    queryKey: [...issueKeys.reports(workspaceId, project), 'report', sprintId],
    queryFn: () => issuesService.sprintReport(token, workspaceId, project, sprintId),
    enabled: active && scrum && Boolean(sprintId),
    staleTime: 15_000,
  })
  const velocity = useQuery({
    queryKey: [...issueKeys.reports(workspaceId, project), 'velocity'],
    queryFn: () => issuesService.velocity(token, workspaceId, project),
    enabled: active && scrum,
    staleTime: 30_000,
  })
  const flow = useQuery({
    queryKey: [...issueKeys.reports(workspaceId, project), 'flow', days],
    queryFn: () => issuesService.flow(token, workspaceId, project, days),
    enabled: active && !scrum,
    staleTime: 30_000,
  })

  const failure = (scrum ? (sprints.error ?? burndown.error ?? report.error ?? velocity.error) : flow.error) ?? null
  const loading =
    active &&
    (scrum ? sprints.isPending || (Boolean(sprintId) && (burndown.isPending || report.isPending)) || velocity.isPending : flow.isPending)
  const points = (count: number) => say(REPORTS_TEXT.report.points, { count })
  const row = (item: ReportItem, detail: string): ReportRow => ({ id: item.id, key: item.key, title: item.title, detail })
  const itemRows = (items: ReportItem[]) =>
    items.map((item) => row(item, item.points === null ? say(REPORTS_TEXT.report.noPoints) : points(item.points)))

  const burn = burndown.data
  const flowData = flow.data

  return {
    mode,
    status: loading ? ('loading' as const) : failure ? ('error' as const) : ('ready' as const),
    error: failure ? readErrorMessage(failure, say(REPORTS_TEXT.error)) : null,
    onRetry: () => void Promise.all([sprints.refetch(), burndown.refetch(), report.refetch(), velocity.refetch(), flow.refetch()]),
    subtitle: say(scrum ? REPORTS_TEXT.subtitleScrum : REPORTS_TEXT.subtitleKanban),
    sprint: {
      options: options.map((item) => ({ value: item.id, label: item.name })),
      selected: sprintId,
      onSelect: setSprintChoice,
      hasSprint: Boolean(sprint),
    },
    burndown:
      burn && sprint
        ? {
            labels: burn.days.map((day) => date(day.date)),
            series: [
              {
                id: 'ideal',
                label: say(REPORTS_TEXT.burndown.ideal),
                tone: 3 as const,
                dashed: true,
                values: burn.days.map((day) => day.ideal),
              },
              {
                id: 'remaining',
                label: say(REPORTS_TEXT.burndown.remaining),
                tone: 1 as const,
                values: burn.days.map((day) => day.remaining),
              },
            ],
            ariaLabel: say(REPORTS_TEXT.burndown.aria, { name: sprint.name, total: burn.total }),
            summary: burn.days
              .filter((day) => day.remaining !== null)
              .map((day) => say(REPORTS_TEXT.burndown.line, { date: date(day.date), remaining: day.remaining })),
          }
        : null,
    report: report.data
      ? {
          committed: points(report.data.committedPoints),
          completed: points(report.data.completedPoints),
          groups: [
            { id: 'finished', title: say(REPORTS_TEXT.report.finished), rows: itemRows(report.data.completed) },
            { id: 'notFinished', title: say(REPORTS_TEXT.report.notFinished), rows: itemRows(report.data.notCompleted) },
            { id: 'added', title: say(REPORTS_TEXT.report.added), rows: itemRows(report.data.addedAfterStart) },
            { id: 'removed', title: say(REPORTS_TEXT.report.removed), rows: itemRows(report.data.removedAfterStart) },
            {
              id: 'estimates',
              title: say(REPORTS_TEXT.report.estimates),
              rows: report.data.pointsChanged.map((item) =>
                row(item, say(REPORTS_TEXT.report.estimate, { before: item.before ?? 0, after: item.after ?? 0 })),
              ),
            },
          ],
          noneLabel: say(REPORTS_TEXT.report.none),
        }
      : null,
    velocity: velocity.data
      ? {
          groups: velocity.data.sprints.map((item) => ({
            id: item.sprintId,
            label: item.name,
            values: [item.committedPoints, item.completedPoints],
          })),
          series: [
            { id: 'committed', label: say(REPORTS_TEXT.velocity.committed), tone: 1 as const },
            { id: 'completed', label: say(REPORTS_TEXT.velocity.completed), tone: 2 as const },
          ],
          average: say(REPORTS_TEXT.velocity.average, { value: velocity.data.averageCompleted }),
          summary: velocity.data.sprints.map((item) =>
            say(REPORTS_TEXT.velocity.line, { name: item.name, committed: item.committedPoints, completed: item.completedPoints }),
          ),
          empty: velocity.data.sprints.length === 0,
        }
      : null,
    flow: flowData
      ? {
          period: {
            value: String(days),
            options: FLOW_PERIODS.map((value) => ({ value: String(value), label: say(REPORTS_TEXT.flow.days, { count: value }) })),
            onSelect: (value: string) => setDays(Number(value)),
          },
          throughput: say(REPORTS_TEXT.flow.finished, { count: flowData.throughput.total }),
          cycleTime: {
            hasData: flowData.cycleTime.count > 0,
            tiles: [
              {
                id: 'average',
                label: say(REPORTS_TEXT.flow.average),
                value: say(REPORTS_TEXT.flow.cycleDays, { value: flowData.cycleTime.average }),
              },
              {
                id: 'median',
                label: say(REPORTS_TEXT.flow.median),
                value: say(REPORTS_TEXT.flow.cycleDays, { value: flowData.cycleTime.median }),
              },
              { id: 'p85', label: say(REPORTS_TEXT.flow.p85), value: say(REPORTS_TEXT.flow.cycleDays, { value: flowData.cycleTime.p85 }) },
            ],
          },
          wip: flowData.wip.byStatus.map((column) => ({
            status: column.status,
            label: say(statusTextKey(column.status)),
            count: column.count,
            limit: column.limit === null ? say(REPORTS_TEXT.flow.noLimit) : say(REPORTS_TEXT.flow.limit, { count: column.limit }),
            over: column.over,
            overLabel: say(REPORTS_TEXT.flow.over),
          })),
          oldest: flowData.workItemAge.oldest.map((item) => ({
            id: item.id,
            key: item.key,
            title: item.title,
            detail: say(REPORTS_TEXT.flow.ageDays, { value: item.ageDays }),
          })),
          cumulative: {
            labels: flowData.cumulativeFlow.map((day) => date(day.date)),
            series: [
              { id: 'done', label: say(REPORTS_TEXT.flow.done), tone: 2 as const, values: flowData.cumulativeFlow.map((day) => day.done) },
              {
                id: 'in_progress',
                label: say(REPORTS_TEXT.flow.inProgress),
                tone: 3 as const,
                values: flowData.cumulativeFlow.map((day) => day.in_progress),
              },
              { id: 'todo', label: say(REPORTS_TEXT.flow.todo), tone: 1 as const, values: flowData.cumulativeFlow.map((day) => day.todo) },
            ],
            ariaLabel: say(REPORTS_TEXT.flow.cfdAria),
            summary: flowData.cumulativeFlow
              .slice(-7)
              .map((day) =>
                say(REPORTS_TEXT.flow.cfdLine, { date: date(day.date), done: day.done, inProgress: day.in_progress, todo: day.todo }),
              ),
          },
        }
      : null,
  }
}
