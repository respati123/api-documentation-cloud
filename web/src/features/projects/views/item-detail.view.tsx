import { FileText, Quote } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import { PROJECTS_TEXT } from '@/features/projects/constants/projects-text.constants'
import type { useItemDetailViewModel } from '@/features/projects/viewmodels/use-item-detail.viewmodel'
import type { usePlanningViewModel } from '@/features/projects/viewmodels/use-planning.viewmodel'
import { EpicDetailView } from '@/features/projects/views/epic-detail.view'
import { ItemActions, ItemEditForm } from '@/features/projects/views/item-actions.view'
import { PlanningActivityView } from '@/features/projects/views/planning-activity.view'
import { PlanningCommentsView } from '@/features/projects/views/planning-comments.view'
import { PlanningCrumbs } from '@/features/projects/views/planning-crumbs.view'
import {
  Avatar,
  CodeChip,
  Notice,
  Panel,
  PanelEmpty,
  ProgressBar,
  PropertyList,
  PropertyRow,
  RoleDot,
  RoleTag,
  STAGE_TONE,
  StatusBadge,
} from '@/features/projects/views/planning-marks.view'
import { DesignNotice, RoleLanes, StoryStageStepper, StoryTabs, UserStoryLine } from '@/features/projects/views/story-parts.view'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Input } from '@/shared/components/primitives/input'
import { SelectField } from '@/shared/components/select-field'

type Planning = ReturnType<typeof usePlanningViewModel>
type Detail = ReturnType<typeof useItemDetailViewModel>

export function ItemDetailView({
  planning,
  onNewStory,
  onOpenTask,
}: {
  planning: Planning
  onNewStory: (epicId: string) => void
  onOpenTask: (taskId: string) => void
}) {
  const { t } = useTranslation('planning')
  const vm = planning.itemDetail
  const item = vm.item
  if (!item) return null
  if (item.kind === 'epic') return <EpicDetailView planning={planning} onNewStory={onNewStory} />
  const extras = planning.storyExtras
  const tasksTotal = extras.tasksTotal || vm.tasks.length

  return (
    <div className="grid gap-4" data-testid={`projects-${item.kind}-detail`}>
      <div className="grid gap-2">
        <PlanningCrumbs
          label={t(PLANNING_TEXT.item.crumbProject)}
          crumbs={[
            { label: t(PLANNING_TEXT.item.crumbProject), onSelect: () => planning.go('flow'), testId: 'projects-item-crumb-flow' },
            { label: t(PLANNING_TEXT.epics.title), onSelect: () => planning.go('epics'), testId: 'projects-item-crumb-epics' },
            ...(vm.parent
              ? [
                  {
                    label: `${vm.parent.code} ${vm.parent.title}`,
                    onSelect: () => planning.openItem(vm.parent?.id ?? ''),
                    testId: 'projects-item-crumb-epic',
                  },
                ]
              : []),
            { label: vm.code },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <CodeChip>{vm.code}</CodeChip>
          <StatusBadge tone={STAGE_TONE[extras.stage].badge}>{t(PLANNING_TEXT.stage[extras.stage])}</StatusBadge>
          <StatusBadge tone={item.publishedAt ? 'success' : 'outline'}>
            {item.publishedAt ? t(PLANNING_TEXT.item.onBoard) : t(PLANNING_TEXT.epics.unpublished)}
          </StatusBadge>
        </div>
        <h2 className="max-w-[40ch] font-heading text-2xl leading-tight font-semibold tracking-tight text-balance">{item.title}</h2>
        <UserStoryLine extras={extras} />
        {item.description && !vm.editing && !extras.userStory?.role && (
          <p className="max-w-[72ch] text-muted-foreground whitespace-pre-wrap">{item.description}</p>
        )}
        <StoryStageStepper stage={extras.stage} />
      </div>

      {extras.error && (
        <Alert variant="destructive">
          <AlertDescription>{extras.error}</AlertDescription>
        </Alert>
      )}
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
          {item.sourceSection && <SourceQuote section={item.sourceSection} />}
          {vm.editing ? (
            <ItemEditForm vm={vm} extras={extras} />
          ) : (
            <StoryTabs extras={extras} description={item.description} acceptance={item.acceptanceCriteria} />
          )}
          <RoleLanes extras={extras} onOpenTask={onOpenTask} />
          {(!extras.available || vm.canAddTask) && <StoryTasks vm={vm} />}
          <PlanningCommentsView vm={planning.comments} testId="projects-item-comments" />
        </div>

        <aside className="grid gap-4 xl:sticky xl:top-4">
          {extras.available && <DesignNotice extras={extras} />}
          <ItemActions vm={vm} extras={extras} />
          <StoryProgress extras={extras} tasksTotal={tasksTotal} />
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <PropertyList>
              {vm.parent && (
                <PropertyRow label={t(PLANNING_TEXT.item.epic)}>
                  <Button
                    variant="link"
                    className="h-auto justify-end px-0 text-right text-[12.5px] whitespace-normal"
                    data-testid="projects-item-parent"
                    onClick={() => planning.openItem(vm.parent?.id ?? '')}
                  >
                    {vm.parent.code} {vm.parent.title}
                  </Button>
                </PropertyRow>
              )}
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
              <PropertyRow label={t(PLANNING_TEXT.item.participants)}>
                {vm.participants.length === 0 ? (
                  <span className="text-[12.5px] text-muted-foreground">{t(PLANNING_TEXT.item.noParticipants)}</span>
                ) : (
                  <span className="flex flex-wrap justify-end gap-1">
                    {vm.participants.map((person) => (
                      <RoleTag key={person.id} discipline={person.discipline}>
                        {person.email.split('@')[0]}
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

function SourceQuote({ section }: { section: string }) {
  const { t } = useTranslation('planning')
  return (
    <figure className="grid gap-1.5 rounded-xl border border-border bg-card px-[18px] py-3.5" data-testid="projects-story-source-section">
      <figcaption className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Quote aria-hidden="true" className="size-3.5" />
        {t(PLANNING_TEXT.epicDetail.fromPrd)}
      </figcaption>
      <blockquote className="max-w-[72ch] text-[13px] leading-relaxed whitespace-pre-wrap">{section}</blockquote>
    </figure>
  )
}

function StoryProgress({ extras, tasksTotal }: { extras: Planning['storyExtras']; tasksTotal: number }) {
  const { t } = useTranslation('planning')
  const { t: tp } = useTranslation('projects')
  return (
    <Panel title={t(PLANNING_TEXT.item.progress)} testId="projects-story-progress">
      <dl className="grid gap-2 px-[18px] py-4 text-[12.5px]">
        <div className="flex justify-between gap-2">
          <dt>{t(PLANNING_TEXT.item.tasksDone)}</dt>
          <dd className="font-semibold tabular-nums">{t(PLANNING_TEXT.epicDetail.ratio, { done: extras.tasksDone, total: tasksTotal })}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>{t(PLANNING_TEXT.story.tabDod)}</dt>
          <dd className="font-semibold tabular-nums">
            {t(PLANNING_TEXT.epicDetail.ratio, { done: extras.dodDone, total: extras.dodTotal })}
          </dd>
        </div>
        <ProgressBar percent={extras.dodPercent} />
      </dl>
      {extras.lanes.length > 0 && (
        <ul className="grid gap-2.5 border-t border-border px-[18px] py-4" data-testid="projects-story-progress-lanes">
          {extras.lanes.map((lane) => (
            <li key={lane.role} className="grid gap-1.5 text-[12.5px]">
              <span className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <RoleDot discipline={lane.role} />
                  {tp(PROJECTS_TEXT.discipline[lane.role])}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {t(PLANNING_TEXT.epicDetail.ratio, { done: lane.done, total: lane.tasks.length })}
                </span>
              </span>
              <ProgressBar percent={lane.percent} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function StoryTasks({ vm }: { vm: Detail }) {
  const { t } = useTranslation('planning')
  return (
    <Panel title={t(PLANNING_TEXT.item.tasks)} description={t(PLANNING_TEXT.item.tasksDetail)} testId="projects-story-tasks">
      {vm.tasks.length === 0 ? (
        <PanelEmpty>{t(PLANNING_TEXT.item.noTasks)}</PanelEmpty>
      ) : (
        <ul className="divide-y divide-border">
          {vm.tasks.map((task) => (
            <li key={task.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-[18px] py-2.5">
              <div className="grid min-w-0 gap-1">
                <span className="truncate font-medium">{task.title}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <RoleTag discipline={task.assigneeDiscipline}>{task.assignee?.split('@')[0] ?? t(PLANNING_TEXT.item.unassigned)}</RoleTag>
                  <StatusBadge tone={task.published ? 'success' : 'secondary'}>
                    {task.published ? t(PLANNING_TEXT.item.onBoard) : t(PLANNING_TEXT.item.draft)}
                  </StatusBadge>
                </span>
              </div>
              {task.canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid={`projects-story-task-edit-${task.id}`}
                  onClick={() => vm.onEditTask(task.id)}
                >
                  {t(PLANNING_TEXT.item.editTask)}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {vm.canAddTask && (
        <form
          className="flex flex-wrap gap-2 border-t border-border px-[18px] py-3"
          onSubmit={(event) => {
            event.preventDefault()
            vm.onSaveTask()
          }}
        >
          <Input
            className="min-w-48 flex-1"
            aria-label={t(PLANNING_TEXT.item.taskTitle)}
            placeholder={t(PLANNING_TEXT.item.taskTitle)}
            data-testid="projects-story-task-title"
            value={vm.taskTitle}
            onChange={(event) => vm.setTaskTitle(event.target.value)}
          />
          <SelectField
            className="w-48"
            label={t(PLANNING_TEXT.item.assignee)}
            testId="projects-story-task-assignee"
            value={vm.taskAssigneeId}
            onValueChange={vm.setTaskAssigneeId}
            options={[
              { value: '', label: t(PLANNING_TEXT.item.unassigned) },
              ...vm.members.map((member) => ({
                value: member.id,
                label: member.email.split('@')[0],
                hint: member.email,
                icon: <Avatar name={member.email} className="size-5 text-[9px]" />,
              })),
            ]}
          />
          <Button type="submit" variant="outline" data-testid="projects-story-task-save" disabled={!vm.canSaveTask}>
            {vm.editingTaskId ? t(PLANNING_TEXT.item.saveTask) : t(PLANNING_TEXT.item.addTask)}
          </Button>
          {vm.editingTaskId && (
            <Button type="button" variant="ghost" data-testid="projects-story-task-cancel" onClick={vm.onCancelTask}>
              {t(PLANNING_TEXT.item.cancel)}
            </Button>
          )}
        </form>
      )}
    </Panel>
  )
}
