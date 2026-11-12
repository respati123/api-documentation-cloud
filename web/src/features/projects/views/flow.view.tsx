import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import { PROJECTS_TEXT } from '@/features/projects/constants/projects-text.constants'
import type { ProjectDiscipline } from '@/features/projects/models/project.model'
import type { PipelineCounts } from '@/features/projects/utils/planning'
import type { ProjectSection, usePlanningViewModel } from '@/features/projects/viewmodels/use-planning.viewmodel'
import {
  AgentAvatar,
  Avatar,
  CodeChip,
  Panel,
  PanelEmpty,
  PropertyList,
  PropertyRow,
  RoleTag,
  StatusIcon,
  type StatusTone,
} from '@/features/projects/views/planning-marks.view'
import { Button } from '@/shared/components/primitives/button'

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

export function FlowView({ flow, onGo, onManageTeam }: { flow: Flow; onGo: (section: ProjectSection) => void; onManageTeam: () => void }) {
  const { t } = useTranslation('planning')
  const { t: tp } = useTranslation('projects')

  return (
    <div className="grid gap-4" data-testid="projects-flow">
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
                onClick={() => onGo(stage.section)}
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
