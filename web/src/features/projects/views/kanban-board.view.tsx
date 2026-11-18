import { Search, SlidersHorizontal } from 'lucide-react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { KANBAN_BOARD_TEXT, SPRINT_BOARD_TEXT } from '@/features/projects/constants/backlog-text.constants'
import type { useKanbanBoardViewModel } from '@/features/projects/viewmodels/use-kanban-board.viewmodel'
import { BoardCardView } from '@/features/projects/views/sprint-board.view'
import { LoadMoreButton } from '@/shared/components/load-more-button'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/primitives/dialog'
import { Input } from '@/shared/components/primitives/input'
import { Label } from '@/shared/components/primitives/label'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { ErrorState } from '@/shared/components/state-views'

export type KanbanBoardProps = ReturnType<typeof useKanbanBoardViewModel>

// The board of a Kanban project: the open work in a column for each status, and a limit on a column as a warning.
export function KanbanBoardView({ vm, onOpenIssue }: { vm: KanbanBoardProps; onOpenIssue?: (id: string) => void }) {
  const { t } = useTranslation('planning')

  if (vm.status === 'loading') {
    return (
      <div className="grid gap-4" data-testid="kanban-board-loading">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (vm.status === 'error') {
    return (
      <ErrorState
        testId="kanban-board-error"
        title={t(KANBAN_BOARD_TEXT.error)}
        message={vm.error ?? ''}
        retryLabel={t(KANBAN_BOARD_TEXT.retry)}
        onRetry={vm.onRetry}
      />
    )
  }
  const empty = vm.columns.every((column) => column.count === 0)

  return (
    <section className="grid gap-4" data-testid="kanban-board" aria-label={t(KANBAN_BOARD_TEXT.title)}>
      <header className="grid gap-0.5">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{t(KANBAN_BOARD_TEXT.title)}</h2>
        <p className="max-w-[62ch] text-[13px] text-muted-foreground">{t(KANBAN_BOARD_TEXT.subtitle)}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-80 min-w-52 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            data-testid="kanban-board-search"
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
          data-testid="kanban-board-mine"
          onClick={vm.toggleMine}
        >
          {t(SPRINT_BOARD_TEXT.mine)}
        </Button>
      </div>

      {vm.moveError && (
        <Alert variant="destructive" data-testid="kanban-board-move-error">
          <AlertDescription>{vm.moveError}</AlertDescription>
        </Alert>
      )}

      {empty && !vm.filtering ? (
        <p className="text-sm text-muted-foreground" data-testid="kanban-board-empty">
          {t(KANBAN_BOARD_TEXT.empty)}
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {vm.columns.map((column) => (
            <div
              key={column.status}
              data-testid={`kanban-column-${column.status}`}
              className="grid min-w-64 flex-1 content-start gap-2 rounded-xl border border-border bg-muted/40 p-3"
            >
              <h3 className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                {column.label}
                <span className="flex items-center gap-1">
                  {column.over && <Badge variant="warning">{t(KANBAN_BOARD_TEXT.overLimit)}</Badge>}
                  <span className="tabular-nums" data-testid={`kanban-count-${column.status}`}>
                    {column.limitLabel}
                  </span>
                  {column.canSetLimit && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t(KANBAN_BOARD_TEXT.setLimit, { status: column.label })}
                      data-testid={`kanban-limit-${column.status}`}
                      onClick={() => vm.limitDialog.onOpen(column.status)}
                    >
                      <SlidersHorizontal />
                    </Button>
                  )}
                </span>
              </h3>
              {column.cards.length === 0 ? (
                <p className="text-xs text-muted-foreground/70">{t(SPRINT_BOARD_TEXT.noCards)}</p>
              ) : (
                column.cards.map((card) => <BoardCardView key={card.id} card={card} onMove={vm.move} onOpen={onOpenIssue} />)
              )}
            </div>
          ))}
        </div>
      )}
      <LoadMoreButton hasMore={vm.hasMore} isLoading={vm.isLoadingMore} onLoadMore={vm.onLoadMore} testId="kanban-board-more" />

      <LimitDialog vm={vm} />
    </section>
  )
}

function LimitDialog({ vm }: { vm: KanbanBoardProps }) {
  const { t } = useTranslation('planning')
  const dialog = vm.limitDialog
  return (
    <Dialog open={dialog.open} onOpenChange={(next) => !next && dialog.onClose()}>
      <DialogContent data-testid="kanban-limit-dialog" className="sm:max-w-sm">
        <form
          className="grid gap-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            dialog.onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{dialog.title}</DialogTitle>
            <DialogDescription>{t(KANBAN_BOARD_TEXT.limitDialog.detail)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="kanban-limit-value">{t(KANBAN_BOARD_TEXT.limitDialog.label)}</Label>
            <Input
              id="kanban-limit-value"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              data-testid="kanban-limit-value"
              value={dialog.value}
              onChange={(event) => dialog.setValue(event.target.value)}
            />
          </div>
          {dialog.error && (
            <Alert variant="destructive" data-testid="kanban-limit-error">
              <AlertDescription>{dialog.error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" data-testid="kanban-limit-cancel" onClick={dialog.onClose}>
              {t(KANBAN_BOARD_TEXT.limitDialog.cancel)}
            </Button>
            <Button type="button" variant="outline" data-testid="kanban-limit-clear" disabled={dialog.isSaving} onClick={dialog.onClear}>
              {t(KANBAN_BOARD_TEXT.limitDialog.clear)}
            </Button>
            <Button type="submit" data-testid="kanban-limit-save" disabled={!dialog.canSubmit}>
              {t(KANBAN_BOARD_TEXT.limitDialog.save)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
