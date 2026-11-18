import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Play, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BACKLOG_TEXT } from '@/features/projects/constants/backlog-text.constants'
import type { BacklogRow, useBacklogViewModel } from '@/features/projects/viewmodels/use-backlog.viewmodel'
import { BacklogDialogsView } from '@/features/projects/views/backlog-dialogs.view'
import { CodeChip, Panel, PanelEmpty, StatusIcon, type StatusTone } from '@/features/projects/views/planning-marks.view'
import { LoadMoreButton } from '@/shared/components/load-more-button'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/components/primitives/dropdown-menu'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { SelectField } from '@/shared/components/select-field'
import { ErrorState } from '@/shared/components/state-views'
import { cn } from '@/shared/utils/cn'

export type BacklogProps = ReturnType<typeof useBacklogViewModel>

const CATEGORY_TONE: Record<BacklogRow['category'], StatusTone> = { todo: 'todo', in_progress: 'progress', done: 'done' }

// The Backlog tab: the open sprints with their items, the loose items below, and the epics on the side.
export function BacklogView({ vm, onOpenIssue }: { vm: BacklogProps; onOpenIssue?: (id: string) => void }) {
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
  const { actions } = vm

  return (
    <div className="grid gap-4" data-testid="backlog-view">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="font-heading text-lg font-semibold tracking-tight">{t(BACKLOG_TEXT.title)}</h2>
          <p className="max-w-[62ch] text-[13px] text-muted-foreground">{t(BACKLOG_TEXT.subtitle)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {vm.canPlan && (
            <Button size="sm" variant="outline" data-testid="backlog-new-sprint" onClick={actions.sprintDialog.onOpenCreate}>
              <Plus data-icon="inline-start" />
              {t(BACKLOG_TEXT.actions.newSprint)}
            </Button>
          )}
          {vm.canCreate && (
            <Button size="sm" data-testid="backlog-new-issue" onClick={actions.issueDialog.onOpen}>
              <Plus data-icon="inline-start" />
              {t(BACKLOG_TEXT.actions.newIssue)}
            </Button>
          )}
        </div>
      </header>

      {actions.rowError && (
        <Alert variant="destructive" data-testid="backlog-row-error">
          <AlertDescription>{actions.rowError}</AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4">
          {vm.sprints.map((sprint) => (
            <Panel
              key={sprint.id}
              testId={`backlog-sprint-${sprint.id}`}
              title={sprint.name}
              description={`${sprint.statusLabel} · ${sprint.dates}`}
              action={
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {sprint.daysLeft && <Badge variant="warning">{sprint.daysLeft}</Badge>}
                  <Badge variant="secondary">{sprint.totals}</Badge>
                  {sprint.canStart && (
                    <Button size="xs" data-testid={`backlog-start-${sprint.id}`} onClick={() => actions.startSprint(sprint.id)}>
                      <Play data-icon="inline-start" />
                      {t(BACKLOG_TEXT.actions.startSprint)}
                    </Button>
                  )}
                  {sprint.canClose && (
                    <Button
                      size="xs"
                      variant="outline"
                      data-testid={`backlog-close-${sprint.id}`}
                      onClick={() => actions.closeDialog.onOpen(sprint.id)}
                    >
                      {t(BACKLOG_TEXT.actions.closeSprint)}
                    </Button>
                  )}
                  {sprint.canEdit && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t(BACKLOG_TEXT.actions.editSprint)}
                      data-testid={`backlog-edit-${sprint.id}`}
                      onClick={() => actions.sprintDialog.onOpenEdit(sprint.id)}
                    >
                      <Pencil />
                    </Button>
                  )}
                </div>
              }
            >
              <p className="border-b border-border px-[18px] py-2.5 text-[13px] text-muted-foreground">
                {sprint.goal}
                {sprint.progress && <span className="ml-2 text-foreground">· {sprint.progress}</span>}
              </p>
              {sprint.rows.length === 0 ? (
                <PanelEmpty>{sprint.emptyLabel}</PanelEmpty>
              ) : (
                <RowList rows={sprint.rows} vm={vm} sprintId={sprint.id} onOpen={onOpenIssue} />
              )}
            </Panel>
          ))}

          <Panel
            testId="backlog-section"
            title={t(BACKLOG_TEXT.section.title)}
            action={<Badge variant="secondary">{vm.backlog.count}</Badge>}
          >
            {vm.backlog.rows.length === 0 ? (
              <PanelEmpty>{vm.backlog.emptyLabel}</PanelEmpty>
            ) : (
              <RowList rows={vm.backlog.rows} vm={vm} sprintId={null} onOpen={onOpenIssue} />
            )}
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
          <Panel
            testId="backlog-goal"
            title={t(BACKLOG_TEXT.productGoal)}
            action={
              vm.canEditGoal ? (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t(BACKLOG_TEXT.actions.editGoal)}
                  data-testid="backlog-edit-goal"
                  onClick={actions.goalDialog.onOpen}
                >
                  <Pencil />
                </Button>
              ) : undefined
            }
          >
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

      <BacklogDialogsView actions={actions} />
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

function RowList({
  rows,
  vm,
  sprintId,
  onOpen,
}: {
  rows: BacklogRow[]
  vm: BacklogProps
  sprintId: string | null
  onOpen?: (id: string) => void
}) {
  const ids = rows.map((row) => row.id)
  return (
    <ul className="divide-y divide-border">
      {rows.map((row, index) => (
        <BacklogItem key={row.id} row={row} index={index} ids={ids} vm={vm} sprintId={sprintId} onOpen={onOpen} />
      ))}
    </ul>
  )
}

function BacklogItem({
  row,
  index,
  ids,
  vm,
  sprintId,
  onOpen,
}: {
  row: BacklogRow
  index: number
  ids: string[]
  vm: BacklogProps
  sprintId: string | null
  onOpen?: (id: string) => void
}) {
  const { t } = useTranslation('planning')
  const { actions } = vm
  const targets = actions.sprintTargets.filter((target) => target.id !== sprintId)
  const hasMenu = vm.canPlan && (sprintId !== null || targets.length > 0)
  return (
    <li data-testid={`backlog-row-${row.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-[18px] py-2.5">
      <div className="flex items-center gap-2">
        <StatusIcon tone={CATEGORY_TONE[row.category]} />
        <CodeChip>{row.key}</CodeChip>
      </div>
      <div className="grid min-w-0 gap-1">
        {onOpen ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto justify-start p-0 text-sm font-medium text-foreground"
            data-testid={`backlog-open-${row.id}`}
            onClick={() => onOpen(row.id)}
          >
            <span className="truncate">{row.title}</span>
          </Button>
        ) : (
          <span className="truncate text-sm font-medium">{row.title}</span>
        )}
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
      <div className="flex items-center gap-1">
        {row.canPublish && (
          <Button size="xs" variant="outline" data-testid={`backlog-publish-${row.id}`} onClick={() => actions.publish(row.id)}>
            {t(BACKLOG_TEXT.actions.publish)}
          </Button>
        )}
        {row.canSetPoints ? (
          <SelectField
            size="sm"
            className="w-28"
            value={row.pointsValue}
            onValueChange={(value) => actions.setPoints(row.id, value)}
            options={actions.issueDialog.pointsOptions}
            label={t(BACKLOG_TEXT.actions.points)}
            testId={`backlog-points-${row.id}`}
          />
        ) : (
          <Badge variant={row.points === null ? 'outline' : 'accent'}>{row.pointsLabel}</Badge>
        )}
        {vm.rankEnabled && (
          <>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={t(BACKLOG_TEXT.actions.moveUp)}
              data-testid={`backlog-up-${row.id}`}
              disabled={index === 0}
              onClick={() => actions.move(ids, index, 'up')}
            >
              <ArrowUp />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={t(BACKLOG_TEXT.actions.moveDown)}
              data-testid={`backlog-down-${row.id}`}
              disabled={index === ids.length - 1}
              onClick={() => actions.move(ids, index, 'down')}
            >
              <ArrowDown />
            </Button>
          </>
        )}
        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t(BACKLOG_TEXT.actions.rowMenu)}
                  data-testid={`backlog-menu-${row.id}`}
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                {targets.length > 0 && <DropdownMenuLabel>{t(BACKLOG_TEXT.actions.addToSprint)}</DropdownMenuLabel>}
                {targets.map((target) => (
                  <DropdownMenuItem
                    key={target.id}
                    data-testid={`backlog-add-${row.id}-${target.id}`}
                    onClick={() => actions.addToSprint(row.id, target.id, row.title)}
                  >
                    {target.name}
                  </DropdownMenuItem>
                ))}
                {sprintId !== null && (
                  <DropdownMenuItem data-testid={`backlog-remove-${row.id}`} onClick={() => actions.removeFromSprint(sprintId, row.id)}>
                    {t(BACKLOG_TEXT.actions.removeFromSprint)}
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  )
}
