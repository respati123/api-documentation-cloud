import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import { STORY_STAGES, type StoryStage } from '@/features/projects/models/story.model'
import type { StageCounts } from '@/features/projects/utils/epics'
import { Avatar } from '@/features/projects/views/planning-marks.view'
import { cn } from '@/shared/utils/cn'

export const STAGE_COLOR: Record<StoryStage, string> = {
  draft: 'bg-stage-draft',
  design: 'bg-stage-design',
  design_approved: 'bg-stage-design-approved',
  in_progress: 'bg-stage-in-progress',
  qa: 'bg-stage-qa',
  done: 'bg-stage-done',
}

export function StageDot({ stage, className }: { stage: StoryStage; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 rounded-full', STAGE_COLOR[stage], className)} />
}

// One segment per stage, sized by how many stories sit in it. The label reads the counts out for screen readers.
export function StageBar({ counts, className }: { counts: StageCounts; className?: string }) {
  const { t } = useTranslation('planning')
  const present = STORY_STAGES.filter((stage) => counts[stage] > 0)
  const summary = present.map((stage) => `${t(PLANNING_TEXT.stage[stage])} ${counts[stage]}`).join(', ')
  return (
    <span
      role="img"
      aria-label={t(PLANNING_TEXT.epics.stageBar, { summary })}
      className={cn('flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted', className)}
    >
      {present.map((stage) => (
        <span key={stage} className={cn('h-full', STAGE_COLOR[stage])} style={{ flexGrow: counts[stage] }} />
      ))}
    </span>
  )
}

export function StageLegend() {
  const { t } = useTranslation('planning')
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
      {STORY_STAGES.map((stage) => (
        <span key={stage} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-2 rounded-[2px]', STAGE_COLOR[stage])} />
          {t(PLANNING_TEXT.stage[stage])}
        </span>
      ))}
    </span>
  )
}

export function StageSteps({ stage, className }: { stage: StoryStage; className?: string }) {
  const { t } = useTranslation('planning')
  const reached = STORY_STAGES.indexOf(stage)
  return (
    <span
      role="img"
      aria-label={t(PLANNING_TEXT.epics.step, { step: reached + 1, total: STORY_STAGES.length, stage: t(PLANNING_TEXT.stage[stage]) })}
      className={cn('flex gap-[3px]', className)}
    >
      {STORY_STAGES.map((step, index) => (
        <span key={step} className={cn('h-1 flex-1 rounded-full', index <= reached ? STAGE_COLOR[stage] : 'bg-border')} />
      ))}
    </span>
  )
}

export function TeamAvatars({ team, max = 4 }: { team: Array<{ id: string; name: string }>; max?: number }) {
  const { t } = useTranslation('planning')
  if (team.length === 0) return null
  const shown = team.slice(0, max)
  const rest = team.length - shown.length
  return (
    <span role="img" aria-label={t(PLANNING_TEXT.epics.team, { names: team.map((person) => person.name).join(', ') })} className="flex">
      {shown.map((person, index) => (
        <Avatar key={person.id} name={person.name} className={cn('size-6 text-[10.5px]', index > 0 && '-ml-1.5')} />
      ))}
      {rest > 0 && (
        <span
          aria-hidden="true"
          className="-ml-1.5 grid size-6 place-items-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground tabular-nums"
        >
          +{rest}
        </span>
      )}
    </span>
  )
}
