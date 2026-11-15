import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { EpicGroup, EpicRow } from '@/features/projects/utils/epics'
import { CodeChip } from '@/features/projects/views/planning-marks.view'
import { StageBar, TeamAvatars } from '@/features/projects/views/stage-marks.view'
import { Button } from '@/shared/components/primitives/button'
import { cn } from '@/shared/utils/cn'

const COLUMN_DOT: Record<EpicGroup, string> = {
  planning: 'bg-stage-draft',
  ready: 'bg-stage-design-approved',
  active: 'bg-stage-in-progress',
  done: 'bg-stage-done',
}

export function EpicsBoardView({ columns, onOpen }: { columns: Array<{ id: EpicGroup; rows: EpicRow[] }>; onOpen: (id: string) => void }) {
  const { t } = useTranslation('planning')
  return (
    <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="projects-epics-board">
      {columns.map((column) => (
        <section
          key={column.id}
          className="grid content-start gap-2 rounded-xl bg-muted p-2.5"
          data-testid={`projects-epics-column-${column.id}`}
        >
          <h3 className="flex items-center gap-2 px-1 py-0.5 font-heading text-[13px] font-semibold">
            <span aria-hidden="true" className={cn('size-2 rounded-full', COLUMN_DOT[column.id])} />
            {t(PLANNING_TEXT.epics.filter[column.id])}
            <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">{column.rows.length}</span>
          </h3>
          {column.rows.length === 0 ? (
            <p className="px-1 py-2 text-[12.5px] text-muted-foreground">{t(PLANNING_TEXT.epics.columnEmpty)}</p>
          ) : (
            column.rows.map((epic) => (
              <Button
                key={epic.id}
                variant="outline"
                data-testid={`projects-epic-board-${epic.id}`}
                className="grid h-auto w-full justify-stretch gap-2 rounded-xl bg-card p-3 text-left font-normal whitespace-normal hover:border-primary/40 hover:bg-card"
                onClick={() => onOpen(epic.id)}
              >
                <span className="flex items-center gap-2">
                  <CodeChip>{epic.code}</CodeChip>
                  {epic.outdated && (
                    <TriangleAlert aria-label={t(PLANNING_TEXT.documents.sourceChanged)} className="size-3.5 text-warning" />
                  )}
                </span>
                <span className="font-heading text-sm leading-snug font-semibold">{epic.title}</span>
                <StageBar counts={epic.stageCounts} />
                <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {epic.stories.length > 0
                      ? t(PLANNING_TEXT.epics.progress, { done: epic.storiesDone, total: epic.stories.length })
                      : t(PLANNING_TEXT.epics.noStories)}
                  </span>
                  <TeamAvatars team={epic.team} max={3} />
                </span>
              </Button>
            ))
          )}
        </section>
      ))}
    </div>
  )
}
