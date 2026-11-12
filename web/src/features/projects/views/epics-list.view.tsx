import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { usePlanningViewModel } from '@/features/projects/viewmodels/use-planning.viewmodel'
import { CodeChip, ITEM_TONE, STAGE_TONE, StatusBadge, StatusIcon } from '@/features/projects/views/planning-marks.view'
import { Button } from '@/shared/components/primitives/button'
import { EmptyState } from '@/shared/components/state-views'

type Epics = ReturnType<typeof usePlanningViewModel>['epics']

export function EpicsListView({ epics, canManage, onNewEpic }: { epics: Epics; canManage: boolean; onNewEpic: () => void }) {
  const { t } = useTranslation('planning')
  return (
    <div className="grid gap-3.5" data-testid="projects-epics">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-heading text-lg font-semibold tracking-tight">{t(PLANNING_TEXT.epics.title)}</h2>
        {canManage && (
          <Button data-testid="projects-epics-new" disabled={!epics.canCreate} onClick={onNewEpic}>
            <Plus data-icon="inline-start" />
            {t(PLANNING_TEXT.epics.newEpic)}
          </Button>
        )}
      </div>
      {canManage && !epics.canCreate && <p className="text-sm text-muted-foreground">{t(PLANNING_TEXT.epics.needsPrd)}</p>}

      {epics.rows.length === 0 ? (
        <EmptyState title={t(PLANNING_TEXT.epics.empty)} detail={t(PLANNING_TEXT.epics.emptyDetail)} testId="projects-epics-empty" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {epics.rows.map((epic) => (
            <div key={epic.id} className="border-b border-border last:border-b-0">
              <Button
                variant="ghost"
                data-testid={`projects-epic-${epic.id}`}
                className="grid h-auto w-full grid-cols-[16px_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-none bg-muted px-[18px] py-2.5 text-left whitespace-normal hover:bg-muted/70"
                onClick={() => epics.open(epic.id)}
              >
                <StatusIcon tone={ITEM_TONE[epic.status].icon} label={t(PLANNING_TEXT.status.item[epic.status])} />
                <CodeChip>{epic.code}</CodeChip>
                <span className="truncate font-semibold">{epic.title}</span>
                <span className="flex items-center gap-2">
                  {epic.outdated && <StatusBadge tone="warning">{t(PLANNING_TEXT.documents.sourceChanged)}</StatusBadge>}
                  <StatusBadge tone={ITEM_TONE[epic.status].badge}>{t(PLANNING_TEXT.status.item[epic.status])}</StatusBadge>
                  <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
                    {t(PLANNING_TEXT.epics.storyCount, { count: epic.stories.length })}
                  </span>
                </span>
              </Button>
              {epic.stories.length === 0 ? (
                <p className="px-[18px] py-2.5 pl-12 text-[12.5px] text-muted-foreground">{t(PLANNING_TEXT.epics.noStories)}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {epic.stories.map((story) => (
                    <li key={story.id}>
                      <Button
                        variant="ghost"
                        data-testid={`projects-story-${story.id}`}
                        className="grid h-auto w-full grid-cols-[16px_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-none px-[18px] py-2.5 pl-10 text-left font-normal whitespace-normal hover:bg-muted/40"
                        onClick={() => epics.open(story.id)}
                      >
                        <StatusIcon tone={STAGE_TONE[story.stage].icon} label={t(PLANNING_TEXT.stage[story.stage])} />
                        <CodeChip>{story.code}</CodeChip>
                        <span className="truncate font-medium">{story.title}</span>
                        <StatusBadge tone={STAGE_TONE[story.stage].badge}>{t(PLANNING_TEXT.stage[story.stage])}</StatusBadge>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
