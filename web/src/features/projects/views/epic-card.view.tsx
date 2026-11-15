import { ChevronDown, FileText, Plus, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { EpicRow, EpicStoryRow } from '@/features/projects/utils/epics'
import { CodeChip, ITEM_TONE, STAGE_TONE, StatusBadge } from '@/features/projects/views/planning-marks.view'
import { StageBar, StageDot, StageSteps, TeamAvatars } from '@/features/projects/views/stage-marks.view'
import { Button } from '@/shared/components/primitives/button'
import { cn } from '@/shared/utils/cn'

type Props = {
  epic: EpicRow & { open: boolean }
  canAddStory: boolean
  onOpen: (id: string) => void
  onToggle: (id: string) => void
  onNewStory: (epicId: string) => void
}

export function EpicCard({ epic, canAddStory, onOpen, onToggle, onNewStory }: Props) {
  const { t } = useTranslation('planning')
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card" data-testid={`projects-epic-card-${epic.id}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3 px-[18px] py-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
        <div className="grid min-w-0 gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <CodeChip>{epic.code}</CodeChip>
            <StatusBadge tone={ITEM_TONE[epic.status].badge}>{t(PLANNING_TEXT.status.item[epic.status])}</StatusBadge>
            {!epic.published && <StatusBadge tone="outline">{t(PLANNING_TEXT.epics.unpublished)}</StatusBadge>}
          </div>
          <Button
            variant="link"
            data-testid={`projects-epic-${epic.id}`}
            className="h-auto justify-start px-0 text-left font-heading text-base font-semibold whitespace-normal text-foreground hover:text-accent-foreground"
            onClick={() => onOpen(epic.id)}
          >
            {epic.title}
          </Button>
          {epic.summary && <p className="line-clamp-1 text-[13px] text-muted-foreground">{epic.summary}</p>}
          {(epic.source || epic.awaitingDesign > 0) && (
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
              {epic.source && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <FileText aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{epic.source}</span>
                </span>
              )}
              {epic.awaitingDesign > 0 && (
                <span className="text-warning">{t(PLANNING_TEXT.epics.awaitingDesign, { count: epic.awaitingDesign })}</span>
              )}
            </div>
          )}
        </div>

        <div className="col-span-2 row-start-2 grid gap-1.5 lg:col-span-1 lg:row-start-auto">
          <div className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {epic.stories.length > 0
                ? t(PLANNING_TEXT.epics.progress, { done: epic.storiesDone, total: epic.stories.length })
                : t(PLANNING_TEXT.epics.noStories)}
            </span>
            <span className="font-semibold text-foreground tabular-nums">{t(PLANNING_TEXT.epics.percent, { value: epic.percent })}</span>
          </div>
          <StageBar counts={epic.stageCounts} />
        </div>

        <div className="flex items-center gap-2.5">
          <TeamAvatars team={epic.team} />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-expanded={epic.open}
            aria-label={t(epic.open ? PLANNING_TEXT.epics.collapse : PLANNING_TEXT.epics.expand, { code: epic.code })}
            data-testid={`projects-epic-toggle-${epic.id}`}
            onClick={() => onToggle(epic.id)}
          >
            <ChevronDown className={cn('transition-transform duration-200 motion-reduce:transition-none', epic.open && 'rotate-180')} />
          </Button>
        </div>
      </div>

      {epic.outdated && (
        <div className="flex items-center gap-2 border-t border-border bg-warning/10 px-[18px] py-2 text-[12.5px] text-warning">
          <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          {t(PLANNING_TEXT.documents.sourceChanged)}
        </div>
      )}

      {epic.open && (
        <div className="border-t border-border bg-muted/40" data-testid={`projects-epic-stories-${epic.id}`}>
          {epic.stories.length === 0 ? (
            <p className="px-[18px] py-3 text-[13px] text-muted-foreground">{t(PLANNING_TEXT.epics.noStories)}</p>
          ) : (
            <ul className="divide-y divide-border">
              {epic.stories.map((story) => (
                <li key={story.id}>
                  <StoryRow story={story} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          )}
          {canAddStory && (
            <div className="border-t border-border px-[18px] py-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="text-accent-foreground"
                data-testid={`projects-epic-add-story-${epic.id}`}
                onClick={() => onNewStory(epic.id)}
              >
                <Plus data-icon="inline-start" />
                {t(PLANNING_TEXT.item.newStory)}
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export function StoryRow({ story, onOpen }: { story: EpicStoryRow; onOpen: (id: string) => void }) {
  const { t } = useTranslation('planning')
  return (
    <Button
      variant="ghost"
      data-testid={`projects-story-${story.id}`}
      className="grid h-auto w-full grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-3 rounded-none px-[18px] py-2.5 text-left font-normal whitespace-normal hover:bg-muted sm:grid-cols-[8px_auto_minmax(0,1fr)_auto] lg:grid-cols-[8px_auto_minmax(0,1fr)_120px_84px_auto]"
      onClick={() => onOpen(story.id)}
    >
      <StageDot stage={story.stage} />
      <span className="hidden sm:inline">
        <CodeChip>{story.code}</CodeChip>
      </span>
      <span className="truncate font-medium">{story.title}</span>
      <StageSteps stage={story.stage} className="hidden lg:flex" />
      <span className="hidden text-right text-xs text-muted-foreground tabular-nums lg:inline">
        {story.tasksTotal > 0
          ? t(PLANNING_TEXT.epics.tasks, { done: story.tasksDone, total: story.tasksTotal })
          : t(PLANNING_TEXT.epics.noTasks)}
      </span>
      <StatusBadge tone={STAGE_TONE[story.stage].badge}>{t(PLANNING_TEXT.stage[story.stage])}</StatusBadge>
    </Button>
  )
}
