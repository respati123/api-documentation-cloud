import { Check, ChevronRight, Copy, ExternalLink, Lock, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import { PROJECTS_TEXT } from '@/features/projects/constants/projects-text.constants'
import { STORY_STAGES, type StoryStage, WORK_ROLES, type WorkRole } from '@/features/projects/models/story.model'
import type { useStoryExtrasViewModel } from '@/features/projects/viewmodels/use-story-extras.viewmodel'
import {
  Notice,
  Panel,
  PanelEmpty,
  ProgressBar,
  RoleDot,
  RoleTag,
  StatusIcon,
  TASK_TONE,
} from '@/features/projects/views/planning-marks.view'
import { MarkdownContent } from '@/shared/components/markdown-content'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Checkbox } from '@/shared/components/primitives/checkbox'
import { Input } from '@/shared/components/primitives/input'
import { Label } from '@/shared/components/primitives/label'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from '@/shared/components/primitives/tabs'
import { Textarea } from '@/shared/components/primitives/textarea'
import { SelectField } from '@/shared/components/select-field'
import { cn } from '@/shared/utils/cn'

type Extras = ReturnType<typeof useStoryExtrasViewModel>

// A compact track of the six stages: done stages get a check, the current one is highlighted.
export function StoryStageStepper({ stage }: { stage: StoryStage }) {
  const { t } = useTranslation('planning')
  const current = STORY_STAGES.indexOf(stage)
  return (
    <ol
      aria-label={t(PLANNING_TEXT.item.stepper)}
      className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-[12.5px]"
      data-testid="projects-story-stepper"
    >
      {STORY_STAGES.map((step, index) => (
        <li key={step} aria-current={index === current ? 'step' : undefined} className="inline-flex items-center gap-1">
          {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 text-border" />}
          <span
            className={cn(
              'inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-muted-foreground',
              index < current && 'text-success',
              index === current && 'bg-accent font-semibold text-accent-foreground',
            )}
          >
            <span
              className={cn(
                'grid size-4 place-items-center rounded-full border border-current text-[10px]',
                index < current && 'border-success bg-success text-white',
              )}
            >
              {index < current ? <Check className="size-2.5" /> : index + 1}
            </span>
            {t(PLANNING_TEXT.stage[step])}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function UserStoryLine({ extras }: { extras: Extras }) {
  const { t } = useTranslation('planning')
  const story = extras.userStory
  if (!story?.role) return null
  return (
    <p className="max-w-[72ch] text-[15px] leading-relaxed text-muted-foreground" data-testid="projects-story-user-story">
      {t(PLANNING_TEXT.story.as)} <span className="font-medium text-foreground">{story.role}</span>, {t(PLANNING_TEXT.story.want)}{' '}
      <span className="font-medium text-foreground">{story.action}</span>, {t(PLANNING_TEXT.story.so)}{' '}
      <span className="font-medium text-foreground">{story.benefit}</span>.
    </p>
  )
}

export function DesignNotice({ extras }: { extras: Extras }) {
  const { t } = useTranslation('planning')
  if (extras.designApproval)
    return (
      <Notice tone="done" testId="projects-story-design-approved">
        <div>
          <p className="text-sm font-semibold">{t(PLANNING_TEXT.story.designApproved)}</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {t(PLANNING_TEXT.story.designApprovedDetail, { who: extras.designApproval.by.split('@')[0], when: extras.designApproval.when })}
          </p>
        </div>
      </Notice>
    )
  if (extras.stage !== 'draft' && extras.stage !== 'design') return null
  return (
    <Notice tone="review" testId="projects-story-design-pending">
      <div className="grid gap-2">
        <div>
          <p className="text-sm font-semibold">{t(PLANNING_TEXT.story.designPending)}</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{t(PLANNING_TEXT.story.designPendingDetail)}</p>
        </div>
        {extras.canApproveDesign && (
          <Button
            variant="approve"
            className="justify-self-start"
            data-testid="projects-story-approve-design"
            disabled={extras.isApproving}
            onClick={extras.onApproveDesign}
          >
            {t(PLANNING_TEXT.story.approveDesign)}
          </Button>
        )}
      </div>
    </Notice>
  )
}

const triggerClass =
  'h-11 flex-none gap-2 rounded-none border-0 px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground data-active:bg-transparent data-active:text-foreground'

export function StoryTabs({ extras, description, acceptance }: { extras: Extras; description: string; acceptance: string }) {
  const { t } = useTranslation('planning')

  if (extras.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card" data-testid="projects-story-tabs">
      <Tabs defaultValue="flow">
        <TabsList
          variant="line"
          className="relative h-auto w-full justify-start gap-0 overflow-x-auto overflow-y-hidden rounded-none border-b border-border bg-muted/30 px-2"
        >
          <TabsTrigger value="flow" data-testid="projects-story-tab-flow" className={triggerClass}>
            {t(PLANNING_TEXT.story.tabFlow)}
          </TabsTrigger>
          {extras.available && (
            <>
              <TabsTrigger value="dod" data-testid="projects-story-tab-dod" className={triggerClass}>
                {t(PLANNING_TEXT.story.tabDod)}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums',
                    extras.dodTotal > 0 && extras.dodDone === extras.dodTotal
                      ? 'bg-success/10 text-success'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {extras.dodDone}/{extras.dodTotal}
                </span>
              </TabsTrigger>
              <TabsTrigger value="design" data-testid="projects-story-tab-design" className={triggerClass}>
                {t(PLANNING_TEXT.story.tabDesign)}
                <RoleDot discipline="ui_ux" />
              </TabsTrigger>
              <TabsTrigger value="contract" data-testid="projects-story-tab-contract" className={triggerClass}>
                {t(PLANNING_TEXT.story.tabContract)}
                <RoleDot discipline="backend" />
              </TabsTrigger>
              <TabsTrigger value="data" data-testid="projects-story-tab-data" className={triggerClass}>
                {t(PLANNING_TEXT.story.tabDataModel)}
                <RoleDot discipline="backend" />
              </TabsTrigger>
              <TabsTrigger value="tests" data-testid="projects-story-tab-tests" className={triggerClass}>
                {t(PLANNING_TEXT.story.tabTests)}
                <RoleDot discipline="qa" />
              </TabsTrigger>
            </>
          )}
          <TabsIndicator className="bottom-0 left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-primary" />
        </TabsList>

        <TabsContent value="flow" className="grid max-w-[72ch] gap-3 px-[18px] py-4">
          {extras.flowBlocks.length > 0 ? (
            <MarkdownContent blocks={extras.flowBlocks} />
          ) : (
            <p className={cn('text-sm whitespace-pre-wrap', !description && 'text-muted-foreground')}>
              {description || t(PLANNING_TEXT.item.noDescription)}
            </p>
          )}
          <h3 className="font-heading text-[15px] font-semibold">{t(PLANNING_TEXT.item.acceptance)}</h3>
          <p className={cn('text-sm whitespace-pre-wrap', !acceptance && 'text-muted-foreground')}>
            {acceptance || t(PLANNING_TEXT.item.noAcceptance)}
          </p>
        </TabsContent>

        <TabsContent value="dod" className="grid gap-3 px-[18px] py-4">
          {extras.dod.length === 0 ? (
            <PanelEmpty>{t(PLANNING_TEXT.story.dodEmpty)}</PanelEmpty>
          ) : (
            <>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="font-semibold">
                    {t(PLANNING_TEXT.story.dodProgress, { done: extras.dodDone, total: extras.dodTotal })}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{extras.dodPercent}%</span>
                </div>
                <ProgressBar percent={extras.dodPercent} />
              </div>
              <ul className="grid overflow-hidden rounded-xl border border-border">
                {extras.dod.map((entry) => (
                  <li key={entry.id} className="border-b border-border last:border-b-0">
                    <Label
                      className={cn(
                        'grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5 font-normal transition-colors hover:bg-muted/40',
                        entry.done && 'bg-success/[0.03]',
                      )}
                    >
                      <Checkbox
                        data-testid={`projects-story-dod-${entry.id}`}
                        checked={entry.done}
                        onChange={(event) => extras.onToggleDod(entry.id, event.target.checked)}
                      />
                      <span
                        className={cn(
                          'text-sm leading-snug',
                          entry.done && 'text-muted-foreground line-through decoration-muted-foreground/50',
                        )}
                      >
                        {entry.text}
                      </span>
                      <RoleTag discipline={entry.role} />
                    </Label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </TabsContent>

        <TabsContent value="design" className="grid gap-2 px-[18px] py-4">
          {extras.designs.length === 0 ? (
            <PanelEmpty>{t(PLANNING_TEXT.story.designsEmpty)}</PanelEmpty>
          ) : (
            extras.designs.map((design) => (
              <div
                key={design.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border px-3.5 py-3"
              >
                <span
                  aria-hidden="true"
                  className="grid size-8 place-items-center rounded-[9px] bg-muted text-xs font-semibold text-muted-foreground"
                >
                  UI
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{design.title}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {design.note} · {design.createdBy.split('@')[0]}
                    {design.viaKey && ` · ${t(PLANNING_TEXT.story.viaKey, { key: design.viaKey })}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`projects-story-design-${design.id}`}
                  onClick={() => extras.onOpenDesign(design.url)}
                >
                  {t(PLANNING_TEXT.story.openDesign)}
                  <ExternalLink data-icon="inline-end" />
                </Button>
              </div>
            ))
          )}
          {extras.stitchkit.options.length > 0 && (
            <AppPicker
              id="story-stitchkit-screen"
              testId="projects-story-stitchkit"
              label={t(PLANNING_TEXT.story.pickScreen)}
              action={t(PLANNING_TEXT.story.attachScreen)}
              picker={{ ...extras.stitchkit, submit: extras.stitchkit.attach }}
            />
          )}
        </TabsContent>

        <TabsContent value="contract" className="px-[18px] py-4">
          {extras.contracts.length === 0 ? (
            <PanelEmpty>{t(PLANNING_TEXT.story.contractsEmpty)}</PanelEmpty>
          ) : (
            <>
              <p className="mb-2 text-[12.5px] text-muted-foreground">{t(PLANNING_TEXT.story.contractHint)}</p>
              <ul className="divide-y divide-muted">
                {extras.contracts.map((contract) => (
                  <li key={contract.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2.5 py-2.5">
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-center font-mono text-[11px] font-medium',
                        contract.method === 'GET' && 'bg-success/10 text-success',
                        contract.method === 'DELETE' && 'bg-destructive/10 text-destructive',
                        contract.method !== 'GET' && contract.method !== 'DELETE' && 'bg-accent text-accent-foreground',
                      )}
                    >
                      {contract.method}
                    </span>
                    <span className="grid min-w-0">
                      <span className="truncate font-mono text-[12.5px]">{contract.path}</span>
                      <span className="text-xs text-muted-foreground">{contract.requestName}</span>
                    </span>
                    {contract.missing && <Badge variant="destructive">{t(PLANNING_TEXT.story.contractMissing)}</Badge>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </TabsContent>

        <TabsContent value="data" className="grid gap-2 px-[18px] py-4">
          {extras.dataModels.length === 0 ? (
            <PanelEmpty>{t(PLANNING_TEXT.story.dataModelsEmpty)}</PanelEmpty>
          ) : (
            <>
              <p className="text-[12.5px] text-muted-foreground">{t(PLANNING_TEXT.story.dataModelHint)}</p>
              <ul className="divide-y divide-muted">
                {extras.dataModels.map((model) => (
                  <li
                    key={model.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 py-2.5"
                    data-testid={`projects-story-data-model-${model.id}`}
                  >
                    <span className="grid min-w-0">
                      <span className="truncate font-mono text-[12.5px]">{model.tableName}</span>
                      <span className="text-xs text-muted-foreground">{model.projectName}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`projects-story-data-model-remove-${model.id}`}
                      disabled={extras.removingDataModelId === model.id}
                      onClick={() => extras.onRemoveDataModel(model.id)}
                    >
                      <X data-icon="inline-start" />
                      {t(PLANNING_TEXT.story.removeTable)}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {extras.dbdesign.options.length > 0 && (
            <AppPicker
              id="story-dbdesign-table"
              testId="projects-story-dbdesign"
              label={t(PLANNING_TEXT.story.pickTable)}
              action={t(PLANNING_TEXT.story.addTable)}
              picker={{ ...extras.dbdesign, submit: extras.dbdesign.add }}
            />
          )}
        </TabsContent>

        <TabsContent value="tests" className="grid gap-2.5 px-[18px] py-4">
          {extras.testCases.length === 0 ? (
            <PanelEmpty>{t(PLANNING_TEXT.story.testsEmpty)}</PanelEmpty>
          ) : (
            extras.testCases.map((testCase) => (
              <article key={testCase.id} className="overflow-hidden rounded-xl border border-border">
                <header className="flex items-center justify-between gap-2.5 border-b border-border px-3.5 py-2.5">
                  <span className="text-[13px] font-semibold">
                    {testCase.code} · {testCase.title}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`projects-story-copy-${testCase.id}`}
                    onClick={() => void extras.onCopyTestCase(testCase.id, testCase.text)}
                  >
                    <Copy data-icon="inline-start" />
                    {extras.copiedId === testCase.id ? t(PLANNING_TEXT.story.copied) : t(PLANNING_TEXT.story.copy)}
                  </Button>
                </header>
                <pre className="m-0 bg-muted/40 px-3.5 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{testCase.text}</pre>
                {testCase.viaKey && (
                  <p className="border-t border-border px-3.5 py-2 text-xs text-muted-foreground">
                    {t(PLANNING_TEXT.story.viaKey, { key: testCase.viaKey })}
                  </p>
                )}
              </article>
            ))
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}

// A choice from a linked Stitchkit or DBDesign project, and the button that adds it to the story.
function AppPicker({
  id,
  testId,
  label,
  action,
  picker,
}: {
  id: string
  testId: string
  label: string
  action: string
  picker: {
    options: Array<{ value: string; label: string }>
    choice: string
    setChoice: (value: string) => void
    submit: () => void
    isBusy: boolean
  }
}) {
  return (
    <div className="mt-1 flex flex-wrap items-end gap-2" data-testid={`${testId}-picker`}>
      <div className="min-w-56 flex-1">
        <SelectField
          id={id}
          label={label}
          value={picker.choice}
          onValueChange={picker.setChoice}
          options={picker.options}
          testId={`${testId}-select`}
        />
      </div>
      <Button size="sm" data-testid={`${testId}-submit`} disabled={!picker.choice || picker.isBusy} onClick={picker.submit}>
        <Plus data-icon="inline-start" />
        {action}
      </Button>
    </div>
  )
}

export function RoleLanes({ extras, onOpenTask }: { extras: Extras; onOpenTask: (taskId: string) => void }) {
  const { t } = useTranslation('planning')
  const { t: tp } = useTranslation('projects')
  if (!extras.available || extras.lanes.length === 0) return null
  return (
    <Panel
      title={t(PLANNING_TEXT.story.lanes)}
      description={t(PLANNING_TEXT.story.lanesDetail)}
      action={
        <span className="text-xs text-muted-foreground tabular-nums">
          {t(PLANNING_TEXT.story.lanesCount, { done: extras.tasksDone, total: extras.tasksTotal })}
        </span>
      }
      testId="projects-story-lanes"
    >
      {extras.lanes.map((lane) => (
        <div key={lane.role} className="border-t border-border first:border-t-0">
          <div className="flex items-center justify-between gap-2.5 px-[18px] py-2.5">
            <RoleTag discipline={lane.role}>
              {tp(PROJECTS_TEXT.discipline[lane.role])}
              {lane.assignee && ` · ${lane.assignee.split('@')[0]}`}
            </RoleTag>
            <Badge variant={lane.allDone ? 'success' : lane.locked ? 'outline' : lane.started ? 'warning' : 'secondary'}>
              {lane.allDone
                ? t(PLANNING_TEXT.story.laneDone)
                : lane.locked
                  ? t(PLANNING_TEXT.story.laneLocked)
                  : lane.started
                    ? t(PLANNING_TEXT.story.laneProgress)
                    : t(PLANNING_TEXT.story.laneReady)}
            </Badge>
          </div>
          <ul>
            {lane.tasks.map((task) => (
              <li key={task.id}>
                <Button
                  variant="ghost"
                  data-testid={`projects-story-lane-task-${task.id}`}
                  className={cn(
                    'grid h-auto w-full grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 rounded-none px-[18px] py-2 text-left font-normal whitespace-normal hover:bg-muted/40',
                    task.locked && 'text-muted-foreground',
                  )}
                  onClick={() => onOpenTask(task.id)}
                >
                  {task.locked ? <Lock className="size-3.5 text-muted-foreground" /> : <StatusIcon tone={TASK_TONE[task.status]} />}
                  <span className="truncate font-medium">{task.title}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                    {task.waitingFor.length > 0 && (
                      <Badge variant="outline">{t(PLANNING_TEXT.story.waitingFor, { tasks: task.waitingFor.join(', ') })}</Badge>
                    )}
                    {task.subtasks}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Panel>
  )
}

export function StoryEditor({ extras }: { extras: Extras }) {
  const { t } = useTranslation('planning')
  const { t: tp } = useTranslation('projects')
  const editor = extras.editor
  if (!editor) return null
  return (
    <div className="grid gap-4 border-t border-border pt-4" data-testid="projects-story-editor">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t(PLANNING_TEXT.story.userStory)}</legend>
        <Input
          aria-label={t(PLANNING_TEXT.story.asRole)}
          placeholder={t(PLANNING_TEXT.story.asRole)}
          data-testid="projects-story-edit-role"
          value={editor.role}
          onChange={(event) => editor.setRole(event.target.value)}
        />
        <Input
          aria-label={t(PLANNING_TEXT.story.wantAction)}
          placeholder={t(PLANNING_TEXT.story.wantAction)}
          data-testid="projects-story-edit-action"
          value={editor.action}
          onChange={(event) => editor.setAction(event.target.value)}
        />
        <Input
          aria-label={t(PLANNING_TEXT.story.soBenefit)}
          placeholder={t(PLANNING_TEXT.story.soBenefit)}
          data-testid="projects-story-edit-benefit"
          value={editor.benefit}
          onChange={(event) => editor.setBenefit(event.target.value)}
        />
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor="projects-story-edit-flow">{t(PLANNING_TEXT.story.flowLabel)}</Label>
        <Textarea
          id="projects-story-edit-flow"
          data-testid="projects-story-edit-flow"
          className="min-h-32 font-mono text-xs"
          value={editor.flow}
          onChange={(event) => editor.setFlow(event.target.value)}
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t(PLANNING_TEXT.story.dodLabel)}</legend>
        {editor.dod.map((entry) => (
          <div key={entry.key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
            <Input
              aria-label={t(PLANNING_TEXT.story.dodItem)}
              data-testid={`projects-story-edit-dod-${entry.key}`}
              value={entry.text}
              onChange={(event) => editor.setDodText(entry.key, event.target.value)}
            />
            <SelectField
              className="w-36"
              label={t(PLANNING_TEXT.story.dodRole)}
              testId={`projects-story-edit-dod-role-${entry.key}`}
              value={entry.role}
              onValueChange={(value) => editor.setDodRole(entry.key, value as WorkRole)}
              options={WORK_ROLES.map((role) => ({
                value: role,
                label: tp(PROJECTS_TEXT.discipline[role]),
                icon: <RoleDot discipline={role} />,
              }))}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t(PLANNING_TEXT.story.removeDod)}
              data-testid={`projects-story-edit-dod-remove-${entry.key}`}
              onClick={() => editor.removeDod(entry.key)}
            >
              <X />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="justify-self-start"
          data-testid="projects-story-edit-dod-add"
          onClick={editor.addDod}
        >
          <Plus data-icon="inline-start" />
          {t(PLANNING_TEXT.story.addDod)}
        </Button>
      </fieldset>
    </div>
  )
}
