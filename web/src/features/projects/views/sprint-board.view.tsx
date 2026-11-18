import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BACKLOG_TEXT, SPRINT_BOARD_TEXT } from '@/features/projects/constants/backlog-text.constants'
import type { BoardCard, useSprintBoardViewModel } from '@/features/projects/viewmodels/use-sprint-board.viewmodel'
import { CodeChip, Panel, ProgressBar } from '@/features/projects/views/planning-marks.view'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Input } from '@/shared/components/primitives/input'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { SelectField } from '@/shared/components/select-field'
import { EmptyState, ErrorState } from '@/shared/components/state-views'
import { cn } from '@/shared/utils/cn'

export type SprintBoardProps = ReturnType<typeof useSprintBoardViewModel>

// The board of the active sprint: three columns by status category, and one lane for each item or epic.
export function SprintBoardView({ vm, onOpenBacklog }: { vm: SprintBoardProps; onOpenBacklog: () => void }) {
  const { t } = useTranslation('planning')

  if (vm.status === 'loading') {
    return (
      <div className="grid gap-4" data-testid="sprint-board-loading">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (vm.status === 'error') {
    return (
      <ErrorState
        testId="sprint-board-error"
        title={t(SPRINT_BOARD_TEXT.error)}
        message={vm.error ?? ''}
        retryLabel={t(SPRINT_BOARD_TEXT.retry)}
        onRetry={vm.onRetry}
      />
    )
  }
  if (!vm.sprint) {
    return (
      <EmptyState
        testId="sprint-board-empty"
        title={t(SPRINT_BOARD_TEXT.noSprintTitle)}
        detail={t(SPRINT_BOARD_TEXT.noSprintDetail)}
        action={
          <Button size="sm" data-testid="sprint-board-open-backlog" onClick={onOpenBacklog}>
            {t(SPRINT_BOARD_TEXT.openBacklog)}
          </Button>
        }
      />
    )
  }

  return (
    <section className="grid gap-4" data-testid="sprint-board" aria-label={t(SPRINT_BOARD_TEXT.title)}>
      <header className="grid gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-lg font-semibold tracking-tight">{vm.sprint.name}</h2>
          <Badge variant="warning">{vm.sprint.daysLeft}</Badge>
          <Badge variant="secondary">{vm.sprint.totals}</Badge>
        </div>
        <p className="max-w-[62ch] text-[13px] text-muted-foreground">
          {vm.sprint.goal} · {vm.sprint.dates}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-80 min-w-52 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            data-testid="sprint-board-search"
            aria-label={t(SPRINT_BOARD_TEXT.search)}
            placeholder={t(SPRINT_BOARD_TEXT.search)}
            className="h-[34px] pl-8"
            value={vm.search}
            onChange={(event) => vm.setSearch(event.target.value)}
          />
        </div>
        <Button
          size="sm"
          variant={vm.mine ? 'secondary' : 'outline'}
          aria-pressed={vm.mine}
          data-testid="sprint-board-mine"
          onClick={vm.toggleMine}
        >
          {t(SPRINT_BOARD_TEXT.mine)}
        </Button>
        <SelectField
          size="sm"
          className="w-32"
          label={t(SPRINT_BOARD_TEXT.groupLabel)}
          testId="sprint-board-group"
          value={vm.group}
          onValueChange={vm.setGroup}
          options={vm.groupOptions}
        />
      </div>

      {vm.moveError && (
        <Alert variant="destructive" data-testid="sprint-board-move-error">
          <AlertDescription>{vm.moveError}</AlertDescription>
        </Alert>
      )}

      {vm.lanes.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="sprint-board-no-match">
          {t(vm.filtering ? SPRINT_BOARD_TEXT.noMatch : BACKLOG_TEXT.sprint.empty)}
        </p>
      ) : (
        vm.lanes.map((lane) => (
          <Panel
            key={lane.id}
            testId={`sprint-board-lane-${lane.id}`}
            title={
              <span className="flex min-w-0 items-center gap-2">
                {lane.lead && <CodeChip>{lane.lead.key}</CodeChip>}
                <span className="truncate">{lane.title}</span>
              </span>
            }
            description={lane.lead?.typeLabel}
            action={
              <div className="grid w-32 gap-1 text-right text-xs text-muted-foreground">
                <span>{lane.progress}</span>
                <ProgressBar percent={lane.percent} />
              </div>
            }
          >
            <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
              {lane.columns.map((column) => (
                <div key={column.id} className="grid content-start gap-2 p-3" data-testid={`sprint-board-${lane.id}-${column.id}`}>
                  <h4 className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    {column.label}
                    <span className="tabular-nums">{column.cards.length}</span>
                  </h4>
                  {column.cards.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70">{t(SPRINT_BOARD_TEXT.noCards)}</p>
                  ) : (
                    column.cards.map((card) => <Card key={card.id} card={card} onMove={vm.move} />)
                  )}
                </div>
              ))}
            </div>
          </Panel>
        ))
      )}
    </section>
  )
}

function Card({ card, onMove }: { card: BoardCard; onMove: (id: string, status: string) => void }) {
  const { t } = useTranslation('planning')
  return (
    <article
      data-testid={`sprint-board-card-${card.id}`}
      className={cn('grid gap-1.5 rounded-lg border border-border bg-background p-2.5')}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CodeChip>{card.key}</CodeChip>
        <span>{card.typeLabel}</span>
        {card.points !== null && <Badge variant="accent">{card.points}</Badge>}
      </div>
      <p className="text-sm font-medium">{card.title}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{card.assignee}</span>
        {card.canMove ? (
          <SelectField
            size="sm"
            className="w-32"
            label={t(SPRINT_BOARD_TEXT.statusLabel, { key: card.key })}
            testId={`sprint-board-status-${card.id}`}
            value={card.statusValue}
            onValueChange={(value) => onMove(card.id, value)}
            options={card.statusOptions}
          />
        ) : (
          <Badge variant="secondary">{card.statusLabel}</Badge>
        )}
      </div>
    </article>
  )
}
