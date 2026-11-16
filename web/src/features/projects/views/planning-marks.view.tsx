import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PROJECTS_TEXT } from '@/features/projects/constants/projects-text.constants'
import type { DocumentStatus, PlanningStatus } from '@/features/projects/models/planning.model'
import type { ProjectDiscipline, Task } from '@/features/projects/models/project.model'
import type { StoryStage } from '@/features/projects/models/story.model'
import { Badge } from '@/shared/components/primitives/badge'
import { cn } from '@/shared/utils/cn'

export type StatusTone = 'todo' | 'progress' | 'review' | 'done' | 'draft' | 'locked'
type BadgeTone = 'secondary' | 'accent' | 'success' | 'warning' | 'outline'

export const DOCUMENT_TONE: Record<DocumentStatus, { icon: StatusTone; badge: BadgeTone }> = {
  draft: { icon: 'draft', badge: 'secondary' },
  review_pm: { icon: 'review', badge: 'accent' },
  review_team: { icon: 'review', badge: 'accent' },
  approved: { icon: 'done', badge: 'success' },
  superseded: { icon: 'locked', badge: 'outline' },
  discarded: { icon: 'locked', badge: 'outline' },
}

export const ITEM_TONE: Record<PlanningStatus, { icon: StatusTone; badge: BadgeTone }> = {
  draft: { icon: 'draft', badge: 'secondary' },
  refinement: { icon: 'todo', badge: 'secondary' },
  ready: { icon: 'todo', badge: 'accent' },
  in_progress: { icon: 'progress', badge: 'warning' },
  review: { icon: 'review', badge: 'accent' },
  done: { icon: 'done', badge: 'success' },
}

export const STAGE_TONE: Record<StoryStage, { icon: StatusTone; badge: BadgeTone }> = {
  draft: { icon: 'draft', badge: 'secondary' },
  design: { icon: 'review', badge: 'accent' },
  design_approved: { icon: 'todo', badge: 'accent' },
  in_progress: { icon: 'progress', badge: 'warning' },
  qa: { icon: 'review', badge: 'accent' },
  done: { icon: 'done', badge: 'success' },
}

export const TASK_TONE: Record<Task['status'], StatusTone> = {
  backlog: 'todo',
  todo: 'todo',
  in_progress: 'progress',
  in_review: 'review',
  done: 'done',
}

const iconClass: Record<StatusTone, string> = {
  todo: 'border-muted-foreground/60',
  draft: 'border-dotted border-muted-foreground/60',
  locked: 'border-dashed border-muted-foreground/60',
  progress: 'border-warning bg-[conic-gradient(var(--warning)_0_50%,transparent_50%_100%)]',
  review: 'border-accent-foreground bg-[conic-gradient(var(--accent-foreground)_0_75%,transparent_75%_100%)]',
  done: 'border-success bg-success after:absolute after:top-px after:left-[3px] after:h-1.5 after:w-[3px] after:rotate-45 after:border-r-2 after:border-b-2 after:border-card',
}

// Shape carries the state as well as color, so it still reads for people who do not see the difference in hue.
export function StatusIcon({ tone, label, className }: { tone: StatusTone; label?: string; className?: string }) {
  const classes = cn('relative inline-block size-3.5 shrink-0 rounded-full border-2', iconClass[tone], className)
  if (label) return <span role="img" aria-label={label} className={classes} />
  return <span aria-hidden="true" className={classes} />
}

export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <Badge variant={tone}>{children}</Badge>
}

export function CodeChip({ children }: { children: ReactNode }) {
  return <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground">{children}</span>
}

const roleDot: Record<string, string> = {
  pm: 'bg-role-pm',
  tech_lead: 'bg-role-tech-lead',
  ui_ux: 'bg-role-ui-ux',
  backend: 'bg-role-backend',
  frontend: 'bg-role-frontend',
  mobile: 'bg-role-mobile',
  qa: 'bg-role-qa',
}

export function RoleDot({ discipline, className }: { discipline: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-[7px] shrink-0 rounded-full', roleDot[discipline ?? ''] ?? 'bg-border', className)}
    />
  )
}

// A role pill: a small colored dot and a name. The dot is never a fill, so the text keeps full contrast.
export function RoleTag({ discipline, children }: { discipline: string | null; children?: ReactNode }) {
  const { t } = useTranslation('projects')
  const label = discipline && discipline in PROJECTS_TEXT.discipline ? t(PROJECTS_TEXT.discipline[discipline as ProjectDiscipline]) : null
  return (
    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-border bg-card px-2 text-xs font-medium whitespace-nowrap">
      <RoleDot discipline={discipline} />
      {children ?? label}
    </span>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-[26px] shrink-0 place-items-center rounded-full border-2 border-card bg-accent text-[11px] font-semibold text-accent-foreground',
        className,
      )}
    >
      {name.slice(0, 1).toUpperCase() || '?'}
    </span>
  )
}

export function AgentAvatar() {
  return (
    <span
      aria-hidden="true"
      className="grid size-[26px] shrink-0 place-items-center rounded-lg bg-foreground font-mono text-[10px] font-medium text-card"
    >
      AI
    </span>
  )
}

const priorityLevel: Record<Task['priority'], number> = { low: 1, medium: 2, high: 3, urgent: 4 }

export function PriorityMark({ priority, label }: { priority: Task['priority']; label: string }) {
  const level = priorityLevel[priority]
  if (level === 4)
    return (
      <span
        role="img"
        aria-label={label}
        className="grid size-3.5 place-items-center rounded bg-destructive text-[10px] font-bold text-white"
      >
        !
      </span>
    )
  return (
    <span role="img" aria-label={label} className="inline-flex h-3 items-end gap-0.5">
      {['h-[5px]', 'h-2', 'h-3'].map((height, index) => (
        <span key={height} className={cn('w-[3px] rounded-[1px]', height, index < level ? 'bg-foreground' : 'bg-border')} />
      ))}
    </span>
  )
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-muted">
      <span className="block h-full rounded-full bg-success transition-[width] duration-200" style={{ width: `${percent}%` }} />
    </span>
  )
}

export function PropertyList({ children }: { children: ReactNode }) {
  return <dl className="grid divide-y divide-border">{children}</dl>
}

export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2.5 px-[18px] py-2.5">
      <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="m-0 flex flex-wrap items-center gap-1.5 text-sm">{children}</dd>
    </div>
  )
}

const noticeTone = {
  review: 'border-primary/30 bg-accent/50',
  done: 'border-success/30 bg-success/5',
  warning: 'border-warning/30 bg-warning/5',
}

export function Notice({ tone, children, testId }: { tone: keyof typeof noticeTone; children: ReactNode; testId?: string }) {
  return (
    <div
      data-testid={testId}
      className={cn('flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3', noticeTone[tone])}
    >
      {children}
    </div>
  )
}

// A card with a titled header row, the panel shape every project screen uses.
export function Panel({
  title,
  description,
  action,
  children,
  testId,
  clip = true,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  testId?: string
  clip?: boolean
}) {
  return (
    <section data-testid={testId} className={cn('rounded-xl border border-border bg-card', clip && 'overflow-hidden')}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-[18px] py-3.5">
        <div className="grid min-w-0 gap-0.5">
          <h3 className="font-heading text-[15px] font-semibold tracking-tight">{title}</h3>
          {description && <p className="text-[12.5px] text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className="px-[18px] py-5 text-sm text-muted-foreground">{children}</p>
}
