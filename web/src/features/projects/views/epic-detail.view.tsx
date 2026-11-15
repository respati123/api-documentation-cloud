import { CircleCheck, CircleMinus, FileText, Plus, Quote, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import { STORY_STAGES } from '@/features/projects/models/story.model'
import type { EpicListKind, EpicSection } from '@/features/projects/utils/epics'
import type { usePlanningViewModel } from '@/features/projects/viewmodels/use-planning.viewmodel'
import { StoryRow } from '@/features/projects/views/epic-card.view'
import { ItemActions, ItemEditForm } from '@/features/projects/views/item-actions.view'
import { PlanningActivityView } from '@/features/projects/views/planning-activity.view'
import { PlanningCommentsView } from '@/features/projects/views/planning-comments.view'
import { PlanningCrumbs } from '@/features/projects/views/planning-crumbs.view'
import {
  CodeChip,
  ITEM_TONE,
  Notice,
  Panel,
  PanelEmpty,
  PropertyList,
  PropertyRow,
  RoleTag,
  StatusBadge,
} from '@/features/projects/views/planning-marks.view'
import { StageBar, StageDot, StageLegend } from '@/features/projects/views/stage-marks.view'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { cn } from '@/shared/utils/cn'

type Planning = ReturnType<typeof usePlanningViewModel>
type Epic = NonNullable<ReturnType<Planning['epics']['rowOf']>>

// Layout A: the epic reads as a document on the left, and its state stays in a sticky column on the right.
export function EpicDetailView({ planning, onNewStory }: { planning: Planning; onNewStory: (epicId: string) => void }) {
  const { t } = useTranslation('planning')
  const vm = planning.itemDetail
  const item = vm.item
  const epic = item ? planning.epics.rowOf(item.id) : null
  if (!item || !epic) return null
  const canAddStory = vm.canManage && !item.publishedAt

  return (
    <div className="grid gap-4" data-testid="projects-epic-detail">
      <div className="grid gap-2">
        <PlanningCrumbs
          label={t(PLANNING_TEXT.item.crumbProject)}
          crumbs={[
            { label: t(PLANNING_TEXT.item.crumbProject), onSelect: () => planning.go('flow'), testId: 'projects-item-crumb-flow' },
            { label: t(PLANNING_TEXT.epics.title), onSelect: () => planning.go('epics'), testId: 'projects-item-crumb-epics' },
            { label: vm.code },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <CodeChip>{vm.code}</CodeChip>
          <StatusBadge tone={ITEM_TONE[item.status].badge}>{t(PLANNING_TEXT.status.item[item.status])}</StatusBadge>
          <StatusBadge tone={item.publishedAt ? 'success' : 'outline'}>
            {item.publishedAt ? t(PLANNING_TEXT.item.onBoard) : t(PLANNING_TEXT.epics.unpublished)}
          </StatusBadge>
        </div>
        <h2 className="max-w-[40ch] font-heading text-2xl leading-tight font-semibold tracking-tight text-balance">{item.title}</h2>
        <StageStrip epic={epic} />
      </div>

      {vm.error && (
        <Alert variant="destructive">
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      )}
      {item.sourceOutdated && !item.publishedAt && (
        <Notice tone="warning" testId="projects-item-outdated">
          <span className="text-sm">{t(PLANNING_TEXT.item.outdated)}</span>
          {vm.canRebase && (
            <Button size="sm" variant="outline" data-testid="projects-item-rebase" disabled={vm.isBusy} onClick={vm.onRebase}>
              {t(PLANNING_TEXT.item.rebase)}
            </Button>
          )}
        </Notice>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 gap-4">
          {vm.editing ? <ItemEditForm vm={vm} extras={null} /> : <EpicBrief epic={epic} section={item.sourceSection} />}
          <Panel
            title={t(PLANNING_TEXT.item.stories)}
            testId="projects-epic-stories"
            action={
              canAddStory && (
                <Button size="sm" variant="outline" data-testid="projects-epic-new-story" onClick={() => onNewStory(item.id)}>
                  <Plus data-icon="inline-start" />
                  {t(PLANNING_TEXT.item.newStory)}
                </Button>
              )
            }
          >
            {epic.stories.length === 0 ? (
              <PanelEmpty>{t(PLANNING_TEXT.epics.noStories)}</PanelEmpty>
            ) : (
              STORY_STAGES.filter((stage) => epic.stageCounts[stage] > 0).map((stage) => (
                <section key={stage} aria-label={t(PLANNING_TEXT.stage[stage])} data-testid={`projects-epic-stage-${stage}`}>
                  <h4 className="flex items-center gap-2 border-b border-border bg-muted/60 px-[18px] py-1.5 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <StageDot stage={stage} />
                    {t(PLANNING_TEXT.stage[stage])}
                    <span className="ml-auto font-normal tracking-normal tabular-nums">{epic.stageCounts[stage]}</span>
                  </h4>
                  <ul className="divide-y divide-border">
                    {epic.stories
                      .filter((story) => story.stage === stage)
                      .map((story) => (
                        <li key={story.id}>
                          <StoryRow story={story} onOpen={planning.openItem} />
                        </li>
                      ))}
                  </ul>
                </section>
              ))
            )}
          </Panel>
          <PlanningCommentsView vm={planning.comments} testId="projects-item-comments" />
        </div>

        <aside className="grid gap-4 xl:sticky xl:top-4">
          <ItemActions vm={vm} extras={null} />
          <EpicProgress epic={epic} tasksDone={vm.progress.tasksDone} tasksTotal={vm.progress.tasksTotal} />
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <PropertyList>
              {vm.source && (
                <PropertyRow label={t(PLANNING_TEXT.item.source)}>
                  <Button
                    variant="link"
                    className="h-auto justify-end gap-1.5 px-0 text-right text-[12.5px] whitespace-normal"
                    data-testid="projects-item-source"
                    onClick={() => planning.openDocument(vm.source?.id ?? '')}
                  >
                    <FileText data-icon="inline-start" />
                    {vm.source.title} {t(PLANNING_TEXT.documents.version, { version: vm.source.version })}
                  </Button>
                </PropertyRow>
              )}
              <PropertyRow label={t(PLANNING_TEXT.item.published)}>
                <span className="text-right text-[12.5px]">
                  {item.publishedAt ? t(PLANNING_TEXT.item.onBoard) : t(PLANNING_TEXT.item.notPublished)}
                </span>
              </PropertyRow>
              <PropertyRow label={t(PLANNING_TEXT.epicDetail.team)}>
                {epic.team.length === 0 ? (
                  <span className="text-[12.5px] text-muted-foreground">{t(PLANNING_TEXT.epicDetail.noTeam)}</span>
                ) : (
                  <span className="flex flex-wrap justify-end gap-1">
                    {epic.team.map((person) => (
                      <RoleTag key={person.id} discipline={person.discipline}>
                        {person.name}
                      </RoleTag>
                    ))}
                  </span>
                )}
              </PropertyRow>
            </PropertyList>
          </section>
          <PlanningActivityView activity={planning.activity} />
        </aside>
      </div>
    </div>
  )
}

// One line under the title that answers "how far is this epic": the count of stories in each stage.
function StageStrip({ epic }: { epic: Epic }) {
  const { t } = useTranslation('planning')
  if (epic.stories.length === 0) return null
  return (
    <ul
      className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-muted-foreground"
      aria-label={t(PLANNING_TEXT.epics.summary.stages)}
      data-testid="projects-epic-stage-strip"
    >
      {STORY_STAGES.map((stage) => (
        <li key={stage} className={cn('inline-flex items-center gap-1.5', epic.stageCounts[stage] === 0 && 'opacity-50')}>
          <StageDot stage={stage} />
          {t(PLANNING_TEXT.stage[stage])}
          <span className="font-semibold text-foreground tabular-nums">{epic.stageCounts[stage]}</span>
        </li>
      ))}
    </ul>
  )
}

function EpicProgress({ epic, tasksDone, tasksTotal }: { epic: Epic; tasksDone: number; tasksTotal: number }) {
  const { t } = useTranslation('planning')
  const radius = 30
  const circle = 2 * Math.PI * radius
  return (
    <Panel title={t(PLANNING_TEXT.item.progress)} testId="projects-epic-progress">
      <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4 px-[18px] pt-4">
        <svg
          viewBox="0 0 76 76"
          className="size-[72px]"
          role="img"
          aria-label={t(PLANNING_TEXT.epics.progress, { done: epic.storiesDone, total: epic.stories.length })}
        >
          <circle cx="38" cy="38" r={radius} fill="none" strokeWidth="8" className="stroke-muted" />
          <circle
            cx="38"
            cy="38"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(epic.percent / 100) * circle} ${circle}`}
            transform="rotate(-90 38 38)"
            className="stroke-stage-done"
          />
          <text x="38" y="43" textAnchor="middle" className="fill-foreground font-heading text-[16px] font-semibold">
            {t(PLANNING_TEXT.epics.percent, { value: epic.percent })}
          </text>
        </svg>
        <dl className="grid gap-1.5 text-[12.5px]">
          <div className="flex justify-between gap-2">
            <dt>{t(PLANNING_TEXT.item.storiesDone)}</dt>
            <dd className="font-semibold tabular-nums">
              {t(PLANNING_TEXT.epicDetail.ratio, { done: epic.storiesDone, total: epic.stories.length })}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>{t(PLANNING_TEXT.item.tasksDone)}</dt>
            <dd className="font-semibold tabular-nums">{t(PLANNING_TEXT.epicDetail.ratio, { done: tasksDone, total: tasksTotal })}</dd>
          </div>
          <div className={cn('flex justify-between gap-2', epic.awaitingDesign > 0 && 'text-warning')}>
            <dt>{t(PLANNING_TEXT.epicDetail.awaitingDesign)}</dt>
            <dd className="font-semibold tabular-nums">{epic.awaitingDesign}</dd>
          </div>
        </dl>
      </div>
      <div className="grid gap-2 px-[18px] pt-3 pb-4">
        <StageBar counts={epic.stageCounts} />
        <StageLegend />
      </div>
    </Panel>
  )
}

function EpicBrief({ epic, section }: { epic: Epic; section: string | null }) {
  const { t } = useTranslation('planning')
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card" data-testid="projects-epic-overview">
      {epic.sections.length === 0 && !section && (
        <p className="px-[18px] py-4 text-sm text-muted-foreground">{t(PLANNING_TEXT.epicDetail.noDescription)}</p>
      )}
      {epic.sections.map((entry) => (
        <div key={sectionKey(entry)} className="grid gap-2.5 border-b border-border px-[18px] py-4 last:border-b-0">
          {entry.label && <h3 className="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">{entry.label}</h3>}
          <SectionBody entry={entry} />
        </div>
      ))}
      {section && (
        <div className="px-[18px] py-4">
          <figure className="grid gap-1.5 rounded-lg bg-muted px-4 py-3" data-testid="projects-epic-source-section">
            <figcaption className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Quote aria-hidden="true" className="size-3.5" />
              {t(PLANNING_TEXT.epicDetail.fromPrd)}
            </figcaption>
            <blockquote className="max-w-[72ch] text-[13px] leading-relaxed whitespace-pre-wrap">{section}</blockquote>
          </figure>
        </div>
      )}
    </section>
  )
}

const LIST_MARK: Record<EpicListKind, { icon: typeof CircleCheck; className: string }> = {
  outOfScope: { icon: CircleMinus, className: 'text-muted-foreground' },
  criteria: { icon: CircleCheck, className: 'text-success' },
  risks: { icon: TriangleAlert, className: 'text-warning' },
}

function SectionBody({ entry }: { entry: EpicSection }) {
  const { t } = useTranslation('planning')
  if (entry.kind === 'scope')
    return (
      <ul className="flex flex-wrap gap-1.5" data-testid="projects-epic-scope">
        {entry.items.map((requirement) => (
          <li key={requirement} className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs font-medium">
            {requirement}
          </li>
        ))}
      </ul>
    )
  if (entry.kind === 'metrics')
    return (
      <ul className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3" data-testid="projects-epic-metrics">
        {entry.items.map((metric) => (
          <li key={metric.name} className="grid content-start gap-2.5 rounded-xl border border-border px-4 py-3">
            <span className="text-[13px] font-medium">{metric.name}</span>
            <dl className="grid grid-cols-2 gap-3">
              <div className="grid gap-0.5">
                <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {t(PLANNING_TEXT.epicDetail.now)}
                </dt>
                <dd className="font-heading text-[17px] text-muted-foreground tabular-nums">{metric.from}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {t(PLANNING_TEXT.epicDetail.target)}
                </dt>
                <dd className="font-heading text-[17px] font-semibold tabular-nums">{metric.to}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    )
  if (entry.kind === 'goal' || entry.kind === 'text')
    return (
      <p className={cn('max-w-[68ch] leading-relaxed whitespace-pre-wrap', entry.kind === 'goal' ? 'text-[15px]' : 'text-sm')}>
        {entry.text}
      </p>
    )
  const mark = LIST_MARK[entry.kind]
  const Icon = mark.icon
  return (
    <ul className="grid gap-1.5" data-testid={`projects-epic-${entry.kind}`}>
      {entry.items.map((line) => (
        <li key={line} className="grid max-w-[72ch] grid-cols-[16px_minmax(0,1fr)] gap-2 text-sm leading-relaxed">
          <Icon aria-hidden="true" className={cn('mt-[3px] size-4', mark.className)} />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  )
}

function sectionKey(entry: EpicSection): string {
  return `${entry.kind}:${entry.label ?? ''}:${'text' in entry ? entry.text : entry.items.length}`
}
