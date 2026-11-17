import { useTranslation } from 'react-i18next'
import { BACKLOG_TEXT } from '@/features/projects/constants/backlog-text.constants'
import type { BacklogRow, useBacklogViewModel } from '@/features/projects/viewmodels/use-backlog.viewmodel'
import { CodeChip, Panel, PanelEmpty, StatusIcon, type StatusTone } from '@/features/projects/views/planning-marks.view'
import { LoadMoreButton } from '@/shared/components/load-more-button'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { ErrorState } from '@/shared/components/state-views'
import { cn } from '@/shared/utils/cn'

export type BacklogProps = ReturnType<typeof useBacklogViewModel>

const CATEGORY_TONE: Record<BacklogRow['category'], StatusTone> = { todo: 'todo', in_progress: 'progress', done: 'done' }

// The Backlog tab: the open sprints with their items, the loose items below, and the epics on the side.
export function BacklogView({ vm }: { vm: BacklogProps }) {
  const { t } = useTranslation('planning')

  if (vm.status === 'loading') {
    return (
      <div className="grid gap-4" data-testid="backlog-loading">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (vm.status === 'error') {
    return (
      <ErrorState
        testId="backlog-error"
        title={t(BACKLOG_TEXT.error)}
        message={vm.error ?? ''}
        retryLabel={t(BACKLOG_TEXT.retry)}
        onRetry={vm.onRetry}
      />
    )
  }

  return (
    <div className="grid gap-4" data-testid="backlog-view">
      <header className="grid gap-0.5">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{t(BACKLOG_TEXT.title)}</h2>
        <p className="max-w-[62ch] text-[13px] text-muted-foreground">{t(BACKLOG_TEXT.subtitle)}</p>
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4">
          {vm.sprints.map((sprint) => (
            <Panel
              key={sprint.id}
              testId={`backlog-sprint-${sprint.id}`}
              title={sprint.name}
              description={`${sprint.statusLabel} · ${sprint.dates}`}
              action={
                <div className="flex flex-wrap justify-end gap-1.5">
                  {sprint.daysLeft && <Badge variant="warning">{sprint.daysLeft}</Badge>}
                  <Badge variant="secondary">{sprint.totals}</Badge>
                </div>
              }
            >
              <p className="border-b border-border px-[18px] py-2.5 text-[13px] text-muted-foreground">
                {sprint.goal}
                {sprint.progress && <span className="ml-2 text-foreground">· {sprint.progress}</span>}
              </p>
              {sprint.rows.length === 0 ? <PanelEmpty>{sprint.emptyLabel}</PanelEmpty> : <RowList rows={sprint.rows} />}
            </Panel>
          ))}

          <Panel
            testId="backlog-section"
            title={t(BACKLOG_TEXT.section.title)}
            action={<Badge variant="secondary">{vm.backlog.count}</Badge>}
          >
            {vm.backlog.rows.length === 0 ? <PanelEmpty>{vm.backlog.emptyLabel}</PanelEmpty> : <RowList rows={vm.backlog.rows} />}
            <div className="px-[18px] pb-3">
              <LoadMoreButton
                hasMore={vm.backlog.hasMore}
                isLoading={vm.backlog.isLoadingMore}
                onLoadMore={vm.backlog.onLoadMore}
                testId="backlog-load-more"
              />
            </div>
          </Panel>
        </div>

        <aside className="grid gap-4">
          <Panel testId="backlog-goal" title={t(BACKLOG_TEXT.productGoal)}>
            <p className="px-[18px] py-3.5 text-sm">
              {vm.productGoal || <span className="text-muted-foreground">{t(BACKLOG_TEXT.noGoal)}</span>}
            </p>
          </Panel>
          <Panel testId="backlog-epics" title={t(BACKLOG_TEXT.epicsHeading)}>
            <ul className="grid gap-0.5 p-2" aria-label={t(BACKLOG_TEXT.epicsLabel)}>
              <EpicFilter
                id=""
                label={t(BACKLOG_TEXT.allEpics)}
                count={vm.epics.total}
                selected={vm.epics.selected === ''}
                onSelect={vm.epics.onSelect}
              />
              {vm.epics.items.map((epic) => (
                <EpicFilter
                  key={epic.id}
                  id={epic.id}
                  label={epic.title}
                  code={epic.key}
                  count={epic.count}
                  selected={epic.selected}
                  onSelect={vm.epics.onSelect}
                />
              ))}
              <EpicFilter
                id="none"
                label={t(BACKLOG_TEXT.noEpic)}
                count={vm.epics.withoutEpic}
                selected={vm.epics.selected === 'none'}
                onSelect={vm.epics.onSelect}
              />
            </ul>
            <div className="px-2 pb-2">
              <LoadMoreButton
                hasMore={vm.epics.hasMore}
                isLoading={vm.epics.isLoadingMore}
                onLoadMore={vm.epics.onLoadMore}
                testId="backlog-epics-load-more"
              />
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

function EpicFilter({
  id,
  label,
  code,
  count,
  selected,
  onSelect,
}: {
  id: string
  label: string
  code?: string
  count: number
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <li>
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={selected}
        data-testid={`backlog-epic-${id === '' ? 'all' : id}`}
        className={cn('h-8 w-full justify-start gap-2 px-2 font-normal', selected && 'bg-accent text-accent-foreground')}
        onClick={() => onSelect(id)}
      >
        {code && <CodeChip>{code}</CodeChip>}
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      </Button>
    </li>
  )
}

function RowList({ rows }: { rows: BacklogRow[] }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <BacklogItem key={row.id} row={row} />
      ))}
    </ul>
  )
}

function BacklogItem({ row }: { row: BacklogRow }) {
  const { t } = useTranslation('planning')
  return (
    <li data-testid={`backlog-row-${row.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-[18px] py-2.5">
      <div className="flex items-center gap-2">
        <StatusIcon tone={CATEGORY_TONE[row.category]} />
        <CodeChip>{row.key}</CodeChip>
      </div>
      <div className="grid min-w-0 gap-1">
        <span className="truncate text-sm font-medium">{row.title}</span>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
          <Badge variant="outline">{row.typeLabel}</Badge>
          {row.statusLabel && <Badge variant="secondary">{row.statusLabel}</Badge>}
          {row.epicKey && <CodeChip>{row.epicKey}</CodeChip>}
          <span>{row.assignee}</span>
          {row.isDraft && <Badge variant="outline">{t(BACKLOG_TEXT.unpublished)}</Badge>}
          {row.outdated && <Badge variant="warning">{t(BACKLOG_TEXT.outdated)}</Badge>}
          {row.gaps.map((gap) => (
            <Badge key={gap.id} variant="warning">
              {gap.label}
            </Badge>
          ))}
          {row.ready && <Badge variant="success">{t(BACKLOG_TEXT.ready)}</Badge>}
        </div>
      </div>
      <Badge variant={row.points === null ? 'outline' : 'accent'}>{row.pointsLabel}</Badge>
    </li>
  )
}
