import { LayoutList, Plus, Search, SquareKanban } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { usePlanningViewModel } from '@/features/projects/viewmodels/use-planning.viewmodel'
import { EpicCard } from '@/features/projects/views/epic-card.view'
import { EpicsBoardView } from '@/features/projects/views/epics-board.view'
import { StageBar, StageLegend } from '@/features/projects/views/stage-marks.view'
import { Button } from '@/shared/components/primitives/button'
import { Input } from '@/shared/components/primitives/input'
import { EmptyState } from '@/shared/components/state-views'
import { cn } from '@/shared/utils/cn'

type Epics = ReturnType<typeof usePlanningViewModel>['epics']

type Props = { epics: Epics; canManage: boolean; onNewEpic: () => void; onNewStory: (epicId: string) => void }

export function EpicsListView({ epics, canManage, onNewEpic, onNewStory }: Props) {
  const { t } = useTranslation('planning')
  return (
    <div className="grid gap-4" data-testid="projects-epics">
      <header className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-56 flex-1 gap-0.5">
          <h2 className="font-heading text-lg font-semibold tracking-tight">{t(PLANNING_TEXT.epics.title)}</h2>
          <p className="max-w-[60ch] text-[13px] text-muted-foreground">{t(PLANNING_TEXT.epics.subtitle)}</p>
        </div>
        {canManage && (
          <Button data-testid="projects-epics-new" disabled={!epics.canCreate} onClick={onNewEpic}>
            <Plus data-icon="inline-start" />
            {t(PLANNING_TEXT.epics.newEpic)}
          </Button>
        )}
      </header>
      {canManage && !epics.canCreate && <p className="text-sm text-muted-foreground">{t(PLANNING_TEXT.epics.needsPrd)}</p>}

      {epics.total === 0 ? (
        <EmptyState title={t(PLANNING_TEXT.epics.empty)} detail={t(PLANNING_TEXT.epics.emptyDetail)} testId="projects-epics-empty" />
      ) : (
        <>
          <EpicsSummary summary={epics.summary} />
          <Toolbar epics={epics} />
          {epics.visible.length === 0 ? (
            <p
              className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
              data-testid="projects-epics-no-match"
            >
              {t(PLANNING_TEXT.epics.noMatch)}
            </p>
          ) : epics.layout === 'board' ? (
            <EpicsBoardView columns={epics.columns} onOpen={epics.open} />
          ) : (
            <div className="grid gap-3" data-testid="projects-epics-list">
              {epics.visible.map((epic) => (
                <EpicCard
                  key={epic.id}
                  epic={epic}
                  canAddStory={canManage && !epic.published}
                  onOpen={epics.open}
                  onToggle={epics.toggle}
                  onNewStory={onNewStory}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EpicsSummary({ summary }: { summary: Epics['summary'] }) {
  const { t } = useTranslation('planning')
  const cells = [
    { label: t(PLANNING_TEXT.epics.summary.active), value: summary.active, of: summary.epics, warn: false },
    { label: t(PLANNING_TEXT.epics.summary.storiesDone), value: summary.storiesDone, of: summary.stories, warn: false },
    { label: t(PLANNING_TEXT.epics.summary.awaitingDesign), value: summary.awaitingDesign, of: null, warn: summary.awaitingDesign > 0 },
  ]
  return (
    <section
      aria-label={t(PLANNING_TEXT.epics.summary.label)}
      className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-4"
      data-testid="projects-epics-summary"
    >
      {cells.map((cell, index) => (
        <div
          key={cell.label}
          className={cn(
            'grid min-w-0 gap-0.5 px-[18px] py-3.5',
            index > 0 && 'lg:border-l',
            index % 2 === 1 && 'border-l',
            index > 1 && 'border-t lg:border-t-0',
          )}
        >
          <span className="text-xs text-muted-foreground">{cell.label}</span>
          <span className={cn('font-heading text-[22px] leading-tight font-semibold tabular-nums', cell.warn && 'text-warning')}>
            {cell.value}{' '}
            <span className="font-sans text-[13px] font-medium text-muted-foreground">
              {cell.of === null ? t(PLANNING_TEXT.epics.summary.storyUnit) : t(PLANNING_TEXT.epics.summary.ofTotal, { count: cell.of })}
            </span>
          </span>
        </div>
      ))}
      <div className="grid min-w-0 content-center gap-2 border-t border-l px-[18px] py-3.5 lg:border-t-0">
        <span className="text-xs text-muted-foreground">{t(PLANNING_TEXT.epics.summary.stages)}</span>
        <StageBar counts={summary.stageCounts} />
        <StageLegend />
      </div>
    </section>
  )
}

function Toolbar({ epics }: { epics: Epics }) {
  const { t } = useTranslation('planning')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          className="h-8.5 bg-card pl-8"
          data-testid="projects-epics-search"
          aria-label={t(PLANNING_TEXT.epics.search)}
          placeholder={t(PLANNING_TEXT.epics.search)}
          value={epics.query}
          onChange={(event) => epics.setQuery(event.target.value)}
        />
      </div>
      <fieldset className="flex flex-wrap gap-1.5" aria-label={t(PLANNING_TEXT.epics.filterLabel)}>
        {epics.filters.map((filter) => (
          <Button
            key={filter.id}
            size="sm"
            variant={epics.filter === filter.id ? 'secondary' : 'outline'}
            aria-pressed={epics.filter === filter.id}
            data-testid={`projects-epics-filter-${filter.id}`}
            className={cn('rounded-full', epics.filter === filter.id && 'bg-accent text-accent-foreground hover:bg-accent')}
            onClick={() => epics.setFilter(filter.id)}
          >
            {t(PLANNING_TEXT.epics.filter[filter.id])}
            <span className="text-[11.5px] opacity-70 tabular-nums">{filter.count}</span>
          </Button>
        ))}
      </fieldset>
      <fieldset className="flex rounded-lg bg-muted p-0.5 sm:ml-auto" aria-label={t(PLANNING_TEXT.epics.layout.label)}>
        {(['list', 'board'] as const).map((layout) => {
          const Icon = layout === 'list' ? LayoutList : SquareKanban
          const active = epics.layout === layout
          return (
            <Button
              key={layout}
              size="sm"
              variant="ghost"
              aria-pressed={active}
              data-testid={`projects-epics-layout-${layout}`}
              className={cn('h-7 rounded-md', active ? 'bg-card text-foreground shadow-xs hover:bg-card' : 'text-muted-foreground')}
              onClick={() => epics.setLayout(layout)}
            >
              <Icon data-icon="inline-start" />
              {t(PLANNING_TEXT.epics.layout[layout])}
            </Button>
          )
        })}
      </fieldset>
    </div>
  )
}
