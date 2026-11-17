import { useTranslation } from 'react-i18next'
import { BACKLOG_TEXT } from '@/features/projects/constants/backlog-text.constants'
import { REPORTS_TEXT } from '@/features/projects/constants/reports-text.constants'
import type { ReportRow, useReportsViewModel } from '@/features/projects/viewmodels/use-reports.viewmodel'
import { CodeChip, Panel, PanelEmpty } from '@/features/projects/views/planning-marks.view'
import { BarChart } from '@/shared/components/charts/bar-chart'
import { LineChart } from '@/shared/components/charts/line-chart'
import { StackedAreaChart } from '@/shared/components/charts/stacked-area-chart'
import { Badge } from '@/shared/components/primitives/badge'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { SelectField } from '@/shared/components/select-field'
import { ErrorState } from '@/shared/components/state-views'

export type ReportsProps = ReturnType<typeof useReportsViewModel>

export function ReportsView({ vm }: { vm: ReportsProps }) {
  const { t } = useTranslation('planning')
  if (vm.status === 'loading') {
    return (
      <div className="grid gap-4" data-testid="reports-loading">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }
  if (vm.status === 'error') {
    return (
      <ErrorState
        testId="reports-error"
        title={t(REPORTS_TEXT.error)}
        message={vm.error ?? ''}
        retryLabel={t(REPORTS_TEXT.retry)}
        onRetry={vm.onRetry}
      />
    )
  }

  return (
    <div className="grid gap-4" data-testid="reports-view">
      <header className="grid gap-0.5">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{t(REPORTS_TEXT.title)}</h2>
        <p className="max-w-[62ch] text-[13px] text-muted-foreground">{vm.subtitle}</p>
      </header>
      {vm.mode === 'scrum' ? <ScrumReports vm={vm} /> : <KanbanReports vm={vm} />}
    </div>
  )
}

function ScrumReports({ vm }: { vm: ReportsProps }) {
  const { t } = useTranslation('planning')
  return (
    <>
      {vm.sprint.hasSprint ? (
        <>
          <div className="grid max-w-xs gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t(REPORTS_TEXT.sprintLabel)}</span>
            <SelectField
              value={vm.sprint.selected}
              onValueChange={vm.sprint.onSelect}
              options={vm.sprint.options}
              label={t(REPORTS_TEXT.sprintLabel)}
              testId="reports-sprint"
            />
          </div>
          {vm.burndown && (
            <Panel testId="reports-burndown" title={t(REPORTS_TEXT.burndown.title)} description={t(REPORTS_TEXT.burndown.detail)}>
              <div className="p-4">
                <LineChart
                  testId="reports-burndown-chart"
                  labels={vm.burndown.labels}
                  series={vm.burndown.series}
                  ariaLabel={vm.burndown.ariaLabel}
                  summary={vm.burndown.summary}
                />
              </div>
            </Panel>
          )}
          {vm.report && (
            <Panel
              testId="reports-report"
              title={t(REPORTS_TEXT.report.title)}
              action={
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Badge variant="secondary">
                    {t(REPORTS_TEXT.report.committed)}: {vm.report.committed}
                  </Badge>
                  <Badge variant="success">
                    {t(REPORTS_TEXT.report.completed)}: {vm.report.completed}
                  </Badge>
                </div>
              }
            >
              <div className="grid gap-4 p-4 md:grid-cols-2">
                {vm.report.groups.map((group) => (
                  <section key={group.id} data-testid={`reports-group-${group.id}`} className="grid content-start gap-1.5">
                    <h4 className="text-[13px] font-semibold">{group.title}</h4>
                    {group.rows.length === 0 ? (
                      <p className="text-[13px] text-muted-foreground">{vm.report?.noneLabel}</p>
                    ) : (
                      <RowList rows={group.rows} />
                    )}
                  </section>
                ))}
              </div>
            </Panel>
          )}
        </>
      ) : (
        <Panel testId="reports-none" title={t(REPORTS_TEXT.burndown.title)}>
          <PanelEmpty>{t(REPORTS_TEXT.noSprint)}</PanelEmpty>
        </Panel>
      )}
      {vm.velocity && (
        <Panel
          testId="reports-velocity"
          title={t(REPORTS_TEXT.velocity.title)}
          description={t(REPORTS_TEXT.velocity.detail)}
          action={vm.velocity.empty ? undefined : <Badge variant="secondary">{vm.velocity.average}</Badge>}
        >
          {vm.velocity.empty ? (
            <PanelEmpty>{t(REPORTS_TEXT.velocity.empty)}</PanelEmpty>
          ) : (
            <div className="p-4">
              <BarChart
                testId="reports-velocity-chart"
                groups={vm.velocity.groups}
                series={vm.velocity.series}
                ariaLabel={t(REPORTS_TEXT.velocity.aria)}
                summary={vm.velocity.summary}
              />
            </div>
          )}
        </Panel>
      )}
    </>
  )
}

function KanbanReports({ vm }: { vm: ReportsProps }) {
  const { t } = useTranslation('planning')
  const flow = vm.flow
  if (!flow) return null
  return (
    <>
      <div className="grid max-w-xs gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t(REPORTS_TEXT.flow.period)}</span>
        <SelectField
          value={flow.period.value}
          onValueChange={flow.period.onSelect}
          options={flow.period.options}
          label={t(REPORTS_TEXT.flow.period)}
          testId="reports-period"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel testId="reports-throughput" title={t(REPORTS_TEXT.flow.throughput)}>
          <p className="px-[18px] py-4 font-heading text-2xl font-semibold tabular-nums">{flow.throughput}</p>
        </Panel>
        <Panel testId="reports-cycle" title={t(REPORTS_TEXT.flow.cycleTime)}>
          {flow.cycleTime.hasData ? (
            <dl className="grid grid-cols-3 gap-2 px-[18px] py-4">
              {flow.cycleTime.tiles.map((tile) => (
                <div key={tile.id} data-testid={`reports-cycle-${tile.id}`} className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">{tile.label}</dt>
                  <dd className="font-heading text-lg font-semibold tabular-nums">{tile.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <PanelEmpty>{t(REPORTS_TEXT.flow.noCycle)}</PanelEmpty>
          )}
        </Panel>
      </div>

      <Panel testId="reports-wip" title={t(REPORTS_TEXT.flow.wip)} description={t(REPORTS_TEXT.flow.wipDetail)}>
        {flow.wip.length === 0 ? (
          <PanelEmpty>{t(REPORTS_TEXT.flow.noWip)}</PanelEmpty>
        ) : (
          <ul className="divide-y divide-border">
            {flow.wip.map((column) => (
              <li
                key={column.status}
                data-testid={`reports-wip-${column.status}`}
                className="flex flex-wrap items-center gap-2 px-[18px] py-2.5"
              >
                <span className="min-w-0 flex-1 text-sm font-medium">{column.label}</span>
                <span className="text-sm tabular-nums">{column.count}</span>
                <Badge variant={column.over ? 'warning' : 'outline'}>{column.limit}</Badge>
                {column.over && <Badge variant="warning">{column.overLabel}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel testId="reports-cfd" title={t(REPORTS_TEXT.flow.cfd)} description={t(REPORTS_TEXT.flow.cfdDetail)}>
        <div className="p-4">
          <StackedAreaChart
            testId="reports-cfd-chart"
            labels={flow.cumulative.labels}
            series={flow.cumulative.series}
            ariaLabel={flow.cumulative.ariaLabel}
            summary={flow.cumulative.summary}
          />
        </div>
      </Panel>

      <Panel testId="reports-age" title={t(REPORTS_TEXT.flow.age)}>
        {flow.oldest.length === 0 ? (
          <PanelEmpty>{t(REPORTS_TEXT.flow.noAge)}</PanelEmpty>
        ) : (
          <RowList rows={flow.oldest.map((item) => ({ id: item.id, key: item.key, title: item.title, detail: item.detail }))} padded />
        )}
      </Panel>
    </>
  )
}

function RowList({ rows, padded = false }: { rows: ReportRow[]; padded?: boolean }) {
  const { t } = useTranslation('planning')
  return (
    <ul className={padded ? 'divide-y divide-border' : 'grid gap-1'} aria-label={t(BACKLOG_TEXT.title)}>
      {rows.map((row) => (
        <li
          key={row.id}
          data-testid={`reports-row-${row.id}`}
          className={padded ? 'flex items-center gap-2 px-[18px] py-2.5' : 'flex items-center gap-2 text-[13px]'}
        >
          <CodeChip>{row.key}</CodeChip>
          <span className="min-w-0 flex-1 truncate">{row.title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{row.detail}</span>
        </li>
      ))}
    </ul>
  )
}
