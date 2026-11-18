import { useTranslation } from 'react-i18next'
import { SPRINT_OVERVIEW_TEXT } from '@/features/projects/constants/backlog-text.constants'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import { PROJECTS_TEXT } from '@/features/projects/constants/projects-text.constants'
import type { ProjectDiscipline } from '@/features/projects/models/project.model'
import type { PipelineCounts } from '@/features/projects/utils/planning'
import type { ProjectSection, usePlanningViewModel } from '@/features/projects/viewmodels/use-planning.viewmodel'
import type { useSprintSummaryViewModel } from '@/features/projects/viewmodels/use-sprint-summary.viewmodel'
import {
  AgentAvatar,
  Avatar,
  CodeChip,
  Panel,
  PanelEmpty,
  ProgressBar,
  PropertyList,
  PropertyRow,
  RoleTag,
  StatusIcon,
  type StatusTone,
} from '@/features/projects/views/planning-marks.view'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { AGILE_PROJECT_ENABLED } from '@/shared/config/features'

type Flow = ReturnType<typeof usePlanningViewModel>['flow']

function stageTone(done: number, total: number, waiting = 0): StatusTone {
  if (total === 0) return 'todo'
  if (waiting > 0) return 'review'
  return done === total ? 'done' : 'progress'
}

const STAGES = [
  { key: 'brd', section: 'documents' },
  { key: 'prd', section: 'documents' },
  { key: 'epic', section: 'epics' },
  { key: 'story', section: 'epics' },
  { key: 'task', section: 'board' },
] as const

function stageSummary(counts: PipelineCounts, key: (typeof STAGES)[number]['key']) {
  if (key === 'brd') return { total: counts.brd.total, tone: stageTone(counts.brd.approved, counts.brd.total), values: counts.brd }
  if (key === 'prd')
    return { total: counts.prd.total, tone: stageTone(counts.prd.approved, counts.prd.total, counts.prd.inReview), values: counts.prd }
  if (key === 'epic') return { total: counts.epic.total, tone: stageTone(counts.epic.published, counts.epic.total), values: counts.epic }
  if (key === 'story') return { total: counts.story.total, tone: stageTone(counts.story.done, counts.story.total), values: counts.story }
  return { total: counts.task.total, tone: stageTone(counts.task.done, counts.task.total), values: counts.task }
}

export type SprintSummary = ReturnType<typeof useSprintSummaryViewModel>

export function FlowView({
  flow,
  sprint,
  onGo,
  onManageTeam,
}: {
  flow: Flow
  sprint?: SprintSummary
  onGo: (section: ProjectSection) => void
  onManageTeam: () => void
}) {
  const { t } = useTranslation('planning')
  const { t: tp } = useTranslation('projects')

  return (
    <div className="grid gap-4" data-testid="projects-flow">
      {sprint && <SprintCard summary={sprint} onGo={onGo} />}
      <ol
        aria-label={t(PLANNING_TEXT.pipeline.label)}
        className="grid overflow-hidden rounded-xl border border-border bg-card md:grid-cols-5"
      >
        {STAGES.map((stage) => {
          const summary = stageSummary(flow.counts, stage.key)
          return (
            <li key={stage.key} className="border-b border-border last:border-0 md:border-r md:border-b-0">
              <Button
                variant="ghost"
                data-testid={`projects-flow-stage-${stage.key}`}
                className="grid h-auto w-full justify-stretch gap-1.5 rounded-none px-4 py-3.5 text-left whitespace-normal hover:bg-muted/50"
                onClick={() => onGo(AGILE_PROJECT_ENABLED && stage.section === 'epics' ? 'backlog' : stage.section)}
              >
                <span className="flex items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t(PLANNING_TEXT.kind[stage.key])}
                  <StatusIcon tone={summary.tone} />
                </span>
                <span className="font-heading text-[22px] font-semibold tabular-nums">{summary.total}</span>
                <span className="text-[12.5px] font-normal text-muted-foreground">
                  {t(PLANNING_TEXT.pipeline[stage.key], summary.values)}
                </span>
              </Button>
            </li>
          )
        })}
      </ol>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Panel title={t(PLANNING_TEXT.waiting.title)} description={t(PLANNING_TEXT.waiting.detail)} testId="projects-flow-waiting">
          {flow.waiting.length === 0 ? (
            <PanelEmpty>{t(PLANNING_TEXT.waiting.empty)}</PanelEmpty>
          ) : (
            <ul className="divide-y divide-border">
              {flow.waiting.map((entry) => (
                <li key={entry.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-[18px] py-3">
                  {entry.byAgent ? <AgentAvatar /> : <Avatar name={entry.title} />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CodeChip>{entry.code.toUpperCase()}</CodeChip>
                      <span className="truncate font-medium">{entry.title}</span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">{t(PLANNING_TEXT.waiting.reason[entry.reason])}</p>
                  </div>
                  <Button size="sm" variant="outline" data-testid={`projects-flow-open-${entry.key}`} onClick={entry.onOpen}>
                    {t(PLANNING_TEXT.waiting.open)}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="grid gap-4">
          <Panel
            title={t(PLANNING_TEXT.team.title)}
            action={
              <Button size="sm" variant="link" className="h-auto px-0" data-testid="projects-flow-manage-team" onClick={onManageTeam}>
                {t(PLANNING_TEXT.team.manage)}
              </Button>
            }
          >
            {flow.team.length === 0 ? (
              <PanelEmpty>{t(PLANNING_TEXT.team.empty)}</PanelEmpty>
            ) : (
              <PropertyList>
                {flow.team.map((member) => (
                  <PropertyRow
                    key={member.id}
                    label={tp(PROJECTS_TEXT.discipline[member.discipline as ProjectDiscipline] ?? PROJECTS_TEXT.discipline.other)}
                  >
                    <RoleTag discipline={member.discipline}>{member.email.split('@')[0]}</RoleTag>
                  </PropertyRow>
                ))}
              </PropertyList>
            )}
          </Panel>
          <Panel title={t(PLANNING_TEXT.how.title)}>
            <ol className="m-0 grid list-decimal gap-1.5 py-4 pr-[18px] pl-9 text-[12.5px]">
              <li>{t(PLANNING_TEXT.how.step1)}</li>
              <li>{t(PLANNING_TEXT.how.step2)}</li>
              <li>{t(PLANNING_TEXT.how.step3)}</li>
              <li>{t(PLANNING_TEXT.how.step4)}</li>
              <li>{t(PLANNING_TEXT.how.step5)}</li>
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  )
}

// The running sprint on the overview. With none running, it points to the backlog where one is planned.
function SprintCard({ summary, onGo }: { summary: SprintSummary; onGo: (section: ProjectSection) => void }) {
  const { t } = useTranslation('planning')
  if (summary.status !== 'ready') return null
  const sprint = summary.sprint
  return (
    <Panel
      testId="projects-flow-sprint"
      title={sprint ? `${t(SPRINT_OVERVIEW_TEXT.title)} · ${sprint.name}` : t(SPRINT_OVERVIEW_TEXT.title)}
      action={
        <Button size="xs" variant="outline" data-testid="projects-flow-sprint-open" onClick={() => onGo(sprint ? 'board' : 'backlog')}>
          {t(sprint ? SPRINT_OVERVIEW_TEXT.openBoard : SPRINT_OVERVIEW_TEXT.openBacklog)}
        </Button>
      }
    >
      {sprint ? (
        <div className="grid gap-2 px-[18px] py-3.5">
          <p className="text-sm">{sprint.goal}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="warning">{sprint.daysLeft}</Badge>
            <span>{sprint.points}</span>
            <span>·</span>
            <span>{sprint.items}</span>
          </div>
          <ProgressBar percent={sprint.percent} />
        </div>
      ) : (
        <PanelEmpty>
          {t(SPRINT_OVERVIEW_TEXT.none)} {t(SPRINT_OVERVIEW_TEXT.noneDetail)}
        </PanelEmpty>
      )}
    </Panel>
  )
}
