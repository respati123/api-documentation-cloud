import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TIMELINE_TEXT } from '@/features/projects/constants/timeline-text.constants'
import type { StatusCategory } from '@/features/projects/models/issue.model'
import type { useTimelineViewModel } from '@/features/projects/viewmodels/use-timeline.viewmodel'
import { CodeChip, Panel } from '@/features/projects/views/planning-marks.view'
import { LoadMoreButton } from '@/shared/components/load-more-button'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { EmptyState, ErrorState } from '@/shared/components/state-views'
import { cn } from '@/shared/utils/cn'

export type TimelineProps = ReturnType<typeof useTimelineViewModel>
type Row = TimelineProps['rows'][number]
type Span = Row['span']

const BAR_TONE: Record<StatusCategory, string> = {
  todo: 'bg-muted-foreground/25 text-foreground',
  in_progress: 'bg-primary text-primary-foreground',
  done: 'bg-success text-primary-foreground',
}

const BADGE_TONE: Record<StatusCategory, 'secondary' | 'accent' | 'success'> = {
  todo: 'secondary',
  in_progress: 'accent',
  done: 'success',
}

// The timeline of the project: epics down the side, sprints across, one bar per epic and per ticket.
export function TimelineView({ vm }: { vm: TimelineProps }) {
  const { t } = useTranslation('planning')
  if (vm.status === 'loading') {
    return (
      <div className="grid gap-3" role="status" data-testid="timeline-loading" aria-label={t(TIMELINE_TEXT.loading)}>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (vm.status === 'error') {
    return (
      <ErrorState
        testId="timeline-error"
        title={t(TIMELINE_TEXT.error)}
        message={vm.error ?? ''}
        retryLabel={t(TIMELINE_TEXT.retry)}
        onRetry={vm.onRetry}
      />
    )
  }
  if (vm.rows.length === 0 || vm.columns.length === 0) {
    return <EmptyState testId="timeline-empty" title={t(TIMELINE_TEXT.emptyTitle)} detail={t(TIMELINE_TEXT.emptyDetail)} />
  }

  return (
    <Panel testId="timeline" title={t(TIMELINE_TEXT.title)} description={t(TIMELINE_TEXT.subtitle)}>
      <div className="grid grid-cols-[minmax(180px,260px)_1fr] text-sm">
        <div className="border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground">{t(TIMELINE_TEXT.epic)}</div>
        <div className="flex border-b border-border">
          {vm.columns.map((column) => (
            <div
              key={column.id}
              className={cn('grid flex-1 gap-0.5 border-l border-border px-3 py-2', column.active && 'bg-accent/50')}
              data-testid={`timeline-sprint-${column.id}`}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                {column.name}
                {column.active && <Badge variant="accent">{t(TIMELINE_TEXT.active)}</Badge>}
              </span>
              <span className="text-[11px] text-muted-foreground">{column.dates}</span>
            </div>
          ))}
        </div>
        {vm.rows.map((row) => (
          <TimelineRow key={row.id} row={row} columns={vm.columns} />
        ))}
      </div>
      <div className="px-4 py-3">
        <LoadMoreButton
          hasMore={vm.more.hasMore}
          isLoading={vm.more.isLoadingMore}
          onLoadMore={vm.more.onLoadMore}
          testId="timeline-load-more"
        />
      </div>
    </Panel>
  )
}

function TimelineRow({ row, columns }: { row: Row; columns: TimelineProps['columns'] }) {
  const { t } = useTranslation('planning')
  return (
    <>
      <div className="flex min-w-0 items-center gap-2 border-b border-border px-2 py-2.5" data-testid={`timeline-epic-${row.id}`}>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={row.toggleLabel}
          aria-expanded={row.open}
          data-testid={`timeline-toggle-${row.id}`}
          onClick={row.onToggle}
        >
          {row.open ? <ChevronDown /> : <ChevronRight />}
        </Button>
        <div className="grid min-w-0 gap-0.5">
          <span className="flex items-center gap-1.5">
            <CodeChip>{row.code}</CodeChip>
            <Badge variant={BADGE_TONE[row.category]}>{row.categoryLabel}</Badge>
          </span>
          <span className="truncate font-medium">{row.title}</span>
          <span className="text-[11px] text-muted-foreground">{row.progress}</span>
        </div>
      </div>
      <Track columns={columns} span={row.span} tone={BAR_TONE[row.category]} label={row.code} strong testId={`timeline-bar-${row.id}`} />
      {row.open &&
        row.items.map((item) => <TimelineItem key={item.id} item={item} columns={columns} noSprint={t(TIMELINE_TEXT.noSprint)} />)}
    </>
  )
}

function TimelineItem({ item, columns, noSprint }: { item: Row['items'][number]; columns: TimelineProps['columns']; noSprint: string }) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-2 border-b border-border py-2 pr-2 pl-10" data-testid={`timeline-item-${item.id}`}>
        <CodeChip>{item.code}</CodeChip>
        <span className="truncate text-muted-foreground">{item.title}</span>
      </div>
      {item.span ? (
        <Track
          columns={columns}
          span={item.span}
          tone={BAR_TONE[item.category]}
          label={item.categoryLabel}
          testId={`timeline-bar-${item.id}`}
        />
      ) : (
        <div
          className="flex items-center border-b border-border px-3 text-xs text-muted-foreground"
          data-testid={`timeline-bar-${item.id}`}
        >
          {noSprint}
        </div>
      )}
    </>
  )
}

// The row of a bar: the sprint grid behind it, the bar placed by the span the view model worked out.
function Track({
  columns,
  span,
  tone,
  label,
  strong,
  testId,
}: {
  columns: TimelineProps['columns']
  span: Span
  tone: string
  label: string
  strong?: boolean
  testId: string
}) {
  return (
    <div className="relative flex min-h-11 border-b border-border">
      {columns.map((column) => (
        <div key={column.id} className={cn('flex-1 border-l border-border', column.active && 'bg-accent/30')} />
      ))}
      {span && (
        <div
          className={cn(
            'absolute top-1/2 flex -translate-y-1/2 items-center truncate rounded-md px-2 text-[11px] font-medium',
            strong ? 'h-6' : 'h-4',
            tone,
          )}
          style={{ left: span.left, width: span.width }}
          data-testid={testId}
          title={label}
        >
          {strong ? label : null}
        </div>
      )}
    </div>
  )
}
