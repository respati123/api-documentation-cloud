import { Pencil, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import { storyStage } from '@/features/projects/models/story.model'
import type { useItemDetailViewModel } from '@/features/projects/viewmodels/use-item-detail.viewmodel'
import type { usePlanningViewModel } from '@/features/projects/viewmodels/use-planning.viewmodel'
import { PlanningActivityView } from '@/features/projects/views/planning-activity.view'
import { PlanningCommentsView } from '@/features/projects/views/planning-comments.view'
import { PlanningCrumbs } from '@/features/projects/views/planning-crumbs.view'
import {
  Avatar,
  CodeChip,
  ITEM_TONE,
  Notice,
  Panel,
  PanelEmpty,
  ProgressBar,
  PropertyList,
  PropertyRow,
  RoleTag,
  STAGE_TONE,
  StatusBadge,
  StatusIcon,
} from '@/features/projects/views/planning-marks.view'
import {
  DesignNotice,
  RoleLanes,
  StoryEditor,
  StoryStageStepper,
  StoryTabs,
  UserStoryLine,
} from '@/features/projects/views/story-parts.view'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Checkbox } from '@/shared/components/primitives/checkbox'
import { Input } from '@/shared/components/primitives/input'
import { Label } from '@/shared/components/primitives/label'
import { Textarea } from '@/shared/components/primitives/textarea'
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
  const isEpic = item.kind === 'epic'
  const extras = planning.storyExtras

  return (
    <div className="grid gap-4" data-testid={`projects-${item.kind}-detail`}>
      <div>
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
        <div className="flex flex-wrap items-center gap-2.5">
          <CodeChip>{vm.code}</CodeChip>
          <h2 className="font-heading text-[22px] font-semibold tracking-tight">{item.title}</h2>
          {isEpic ? (
            <StatusBadge tone={ITEM_TONE[item.status].badge}>{t(PLANNING_TEXT.status.item[item.status])}</StatusBadge>
          ) : (
            <StatusBadge tone={STAGE_TONE[extras.stage].badge}>{t(PLANNING_TEXT.stage[extras.stage])}</StatusBadge>
          )}
        </div>
        {!isEpic && <UserStoryLine extras={extras} />}
        {item.description && !vm.editing && (isEpic || !extras.userStory?.role) && (
          <p className="mt-1.5 max-w-[72ch] text-muted-foreground whitespace-pre-wrap">{item.description}</p>
        )}
      </div>

      {!isEpic && <StoryStageStepper stage={extras.stage} />}
      {!isEpic && extras.error && (
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

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-4">
          {vm.editing ? (
            <ItemEditForm vm={vm} extras={isEpic ? null : extras} />
          ) : isEpic ? (
            <EpicStories vm={vm} planning={planning} onNewStory={() => onNewStory(item.id)} />
          ) : (
            <StoryTabs extras={extras} description={item.description} acceptance={item.acceptanceCriteria} />
          )}
          {!isEpic && <RoleLanes extras={extras} onOpenTask={onOpenTask} />}
          {!isEpic && (!extras.available || vm.canAddTask) && <StoryTasks vm={vm} />}
          <PlanningCommentsView vm={planning.comments} testId="projects-item-comments" />
        </div>

        <aside className="grid gap-4">
          {!isEpic && extras.available && <DesignNotice extras={extras} />}
          <ItemActions vm={vm} extras={isEpic ? null : extras} />
          {isEpic && (
            <Panel title={t(PLANNING_TEXT.item.progress)}>
              <div className="grid gap-2.5 px-[18px] py-4 text-[12.5px]">
                <div className="flex justify-between">
                  <span>{t(PLANNING_TEXT.item.storiesDone)}</span>
                  <span className="font-semibold tabular-nums">
                    {vm.progress.storiesDone} / {vm.progress.storiesTotal}
                  </span>
                </div>
                <ProgressBar percent={vm.progress.storiesPercent} />
                <div className="flex justify-between">
                  <span>{t(PLANNING_TEXT.item.tasksDone)}</span>
                  <span className="font-semibold tabular-nums">
                    {vm.progress.tasksDone} / {vm.progress.tasksTotal}
                  </span>
                </div>
                <ProgressBar percent={vm.progress.tasksPercent} />
              </div>
            </Panel>
          )}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <PropertyList>
              <PropertyRow label={t(PLANNING_TEXT.item.status)}>
                {isEpic ? (
                  <StatusBadge tone={ITEM_TONE[item.status].badge}>{t(PLANNING_TEXT.status.item[item.status])}</StatusBadge>
                ) : (
                  <StatusBadge tone={STAGE_TONE[extras.stage].badge}>{t(PLANNING_TEXT.stage[extras.stage])}</StatusBadge>
                )}
              </PropertyRow>
              {vm.parent && (
                <PropertyRow label={t(PLANNING_TEXT.item.epic)}>
                  <Button
                    variant="link"
                    className="h-auto px-0 text-[13px]"
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
                    className="h-auto px-0 text-left text-[13px] whitespace-normal"
                    data-testid="projects-item-source"
                    onClick={() => planning.openDocument(vm.source?.id ?? '')}
                  >
                    {vm.source.title} {t(PLANNING_TEXT.documents.version, { version: vm.source.version })}
                  </Button>
                </PropertyRow>
              )}
              {item.sourceSection && (
                <PropertyRow label={t(PLANNING_TEXT.item.section)}>
                  <span className="text-[12.5px] text-muted-foreground">{item.sourceSection}</span>
                </PropertyRow>
              )}
              <PropertyRow label={t(PLANNING_TEXT.item.published)}>
                <span className="text-[12.5px]">
                  {item.publishedAt ? t(PLANNING_TEXT.item.onBoard) : t(PLANNING_TEXT.item.notPublished)}
                </span>
              </PropertyRow>
              {!isEpic && (
                <PropertyRow label={t(PLANNING_TEXT.item.participants)}>
                  {vm.participants.length === 0 ? (
                    <span className="text-[12.5px] text-muted-foreground">{t(PLANNING_TEXT.item.noParticipants)}</span>
                  ) : (
                    vm.participants.map((person) => (
                      <RoleTag key={person.id} discipline={person.discipline}>
                        {person.email.split('@')[0]}
                      </RoleTag>
                    ))
                  )}
                </PropertyRow>
              )}
            </PropertyList>
          </section>
          <PlanningActivityView activity={planning.activity} />
        </aside>
      </div>
    </div>
  )
}

function ItemActions({ vm, extras }: { vm: Detail; extras: Planning['storyExtras'] | null }) {
  const { t } = useTranslation('planning')
  const showsSomething = vm.canMoveNext || vm.canPublish || vm.canManage
  if (!showsSomething || vm.editing) return null
  return (
    <div className="grid gap-2 rounded-xl border border-border bg-card px-[18px] py-4">
      {vm.canPublish && (
        <>
          <Button variant="approve" data-testid="projects-item-publish" disabled={vm.isBusy} onClick={vm.onPublish}>
            {t(PLANNING_TEXT.item.publish)}
          </Button>
          <p className="text-xs text-muted-foreground">{t(PLANNING_TEXT.item.publishHint)}</p>
        </>
      )}
      {vm.canMoveNext && vm.next && !(vm.next === 'in_progress' && extras && (extras.stage === 'draft' || extras.stage === 'design')) && (
        <Button
          variant={vm.next === 'ready' ? 'approve' : 'default'}
          data-testid="projects-item-next"
          disabled={vm.isBusy}
          onClick={vm.onMoveNext}
        >
          {t(PLANNING_TEXT.item.next, {
            status: vm.item?.kind === 'story' ? t(PLANNING_TEXT.stage[storyStage(vm.next)]) : t(PLANNING_TEXT.status.item[vm.next]),
          })}
        </Button>
      )}
      {vm.canManage && (
        <Button
          variant="outline"
          data-testid="projects-item-edit"
          onClick={() => {
            vm.onEdit()
            extras?.startEdit()
          }}
        >
          <Pencil data-icon="inline-start" />
          {t(PLANNING_TEXT.item.edit)}
        </Button>
      )}
    </div>
  )
}

function EpicStories({ vm, planning, onNewStory }: { vm: Detail; planning: Planning; onNewStory: () => void }) {
  const { t } = useTranslation('planning')
  return (
    <Panel
      title={t(PLANNING_TEXT.item.stories)}
      testId="projects-epic-stories"
      action={
        vm.canManage &&
        !vm.item?.publishedAt && (
          <Button size="sm" variant="outline" data-testid="projects-epic-new-story" onClick={onNewStory}>
            <Plus data-icon="inline-start" />
            {t(PLANNING_TEXT.item.newStory)}
          </Button>
        )
      }
    >
      {vm.stories.length === 0 ? (
        <PanelEmpty>{t(PLANNING_TEXT.epics.noStories)}</PanelEmpty>
      ) : (
        <ul className="divide-y divide-border">
          {vm.stories.map((story) => (
            <li key={story.id}>
              <Button
                variant="ghost"
                data-testid={`projects-epic-story-${story.id}`}
                className="grid h-auto w-full grid-cols-[16px_auto_minmax(0,1fr)] items-center gap-3 rounded-none px-[18px] py-2.5 text-left font-normal whitespace-normal hover:bg-muted/40 sm:grid-cols-[16px_auto_minmax(0,1fr)_auto]"
                onClick={() => planning.openItem(story.id)}
              >
                <StatusIcon tone={STAGE_TONE[story.stage].icon} label={t(PLANNING_TEXT.stage[story.stage])} />
                <CodeChip>{story.code}</CodeChip>
                <span className="truncate font-medium">{story.title}</span>
                <span className="col-span-3 flex items-center gap-2 sm:col-span-1">
                  <StatusBadge tone={STAGE_TONE[story.stage].badge}>{t(PLANNING_TEXT.stage[story.stage])}</StatusBadge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {story.tasksDone}/{story.tasksTotal}
                  </span>
                </span>
              </Button>
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

function ItemEditForm({ vm, extras }: { vm: Detail; extras: Planning['storyExtras'] | null }) {
  const { t } = useTranslation('planning')
  const isStory = vm.item?.kind === 'story'
  return (
    <form
      className="grid gap-4 rounded-xl border border-border bg-card px-[18px] py-4"
      data-testid="projects-item-edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        vm.onSave()
        extras?.saveEdit()
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="planning-item-title">{t(PLANNING_TEXT.item.name)}</Label>
        <Input
          id="planning-item-title"
          data-testid="projects-item-edit-title"
          value={vm.title}
          onChange={(event) => vm.setTitle(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="planning-item-description">{t(PLANNING_TEXT.item.description)}</Label>
        <Textarea
          id="planning-item-description"
          data-testid="projects-item-edit-description"
          className="min-h-28"
          value={vm.description}
          onChange={(event) => vm.setDescription(event.target.value)}
        />
      </div>
      {isStory && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="planning-item-criteria">{t(PLANNING_TEXT.item.acceptance)}</Label>
            <Textarea
              id="planning-item-criteria"
              data-testid="projects-item-edit-criteria"
              className="min-h-28"
              value={vm.criteria}
              onChange={(event) => vm.setCriteria(event.target.value)}
            />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t(PLANNING_TEXT.item.participants)}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {vm.members.map((member) => (
                <Label key={member.id} className="font-normal">
                  <Checkbox
                    data-testid={`projects-item-edit-participant-${member.id}`}
                    checked={vm.selectedParticipants.includes(member.id)}
                    onChange={() => vm.toggleParticipant(member.id)}
                  />
                  {member.email}
                </Label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {extras && <StoryEditor extras={extras} />}
      <div className="flex gap-2">
        <Button type="submit" data-testid="projects-item-save" disabled={!vm.canSave}>
          {t(PLANNING_TEXT.item.save)}
        </Button>
        <Button
          type="button"
          variant="ghost"
          data-testid="projects-item-cancel"
          onClick={() => {
            vm.onCancelEdit()
            extras?.cancelEdit()
          }}
        >
          {t(PLANNING_TEXT.item.cancel)}
        </Button>
      </div>
    </form>
  )
}
