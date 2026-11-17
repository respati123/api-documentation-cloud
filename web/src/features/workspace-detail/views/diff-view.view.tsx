import { ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ACTIVITY_TEXT } from '@/features/workspace-detail/constants/activity-text.constants'
import type { DiffLayout, FileDiffBlock } from '@/features/workspace-detail/models/history.model'
import type { DiffLine, DiffLineKind } from '@/features/workspace-detail/utils/text-diff'
import { Button } from '@/shared/components/primitives/button'
import { cn } from '@/shared/utils/cn'

export interface DiffViewProps {
  fileId: string
  blocks: FileDiffBlock[]
  layout: DiffLayout
  expandedGapKeys: string[]
  onExpandGap: (fileId: string, gapId: string) => void
}

const SIGN: Record<DiffLineKind, string> = { added: '+', removed: '-', same: ' ' }

const LINE_TONE: Record<DiffLineKind, string> = {
  added: 'bg-diff-add',
  removed: 'bg-diff-remove',
  same: 'bg-card',
}

const GUTTER_TONE: Record<DiffLineKind, string> = {
  added: 'bg-diff-add-gutter text-foreground/70',
  removed: 'bg-diff-remove-gutter text-foreground/70',
  same: 'bg-card text-muted-foreground',
}

const WORD_TONE: Record<DiffLineKind, string> = {
  added: 'bg-diff-add-word',
  removed: 'bg-diff-remove-word',
  same: '',
}

// A GitHub-style diff: numbered gutters, + and - marks, word highlights, hunk headers, and folded unchanged lines.
export function DiffView({ fileId, blocks, layout, expandedGapKeys, onExpandGap }: DiffViewProps) {
  return (
    <div className="font-mono text-xs leading-5" data-testid={`history-diff-${fileId}`} data-layout={layout}>
      {blocks.map((block, index) => {
        const nextHunk = blocks.slice(index + 1).find((item) => item.kind === 'hunk')
        if (block.kind === 'gap' && !expandedGapKeys.includes(`${fileId}:${block.id}`)) {
          return (
            <GapRow
              key={block.id}
              count={block.lines.length}
              header={nextHunk?.kind === 'hunk' ? nextHunk.header : ''}
              testId={`history-diff-${fileId}-expand-${block.id}`}
              onExpand={() => onExpandGap(fileId, block.id)}
            />
          )
        }
        return (
          <div key={block.id}>
            {block.kind === 'hunk' && index === 0 && <HunkHeader header={block.header} />}
            {layout === 'unified'
              ? block.lines.map((line) => <UnifiedLine key={`${line.oldLine}-${line.newLine}-${line.kind}`} line={line} />)
              : block.splitRows.map((row) => (
                  <div key={`${row.left?.oldLine ?? 'x'}-${row.right?.newLine ?? 'x'}`} className="grid grid-cols-2 divide-x divide-border">
                    <SplitCell line={row.left} side="old" />
                    <SplitCell line={row.right} side="new" />
                  </div>
                ))}
          </div>
        )
      })}
    </div>
  )
}

function HunkHeader({ header }: { header: string }) {
  return <div className="bg-diff-hunk px-3 py-1 text-diff-hunk-foreground">{header}</div>
}

function GapRow({ count, header, testId, onExpand }: { count: number; header: string; testId: string; onExpand: () => void }) {
  const { t } = useTranslation('activity')
  return (
    <div className="flex items-center gap-2 bg-diff-hunk text-diff-hunk-foreground">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 rounded-none px-3 font-sans text-xs text-diff-hunk-foreground hover:bg-primary/10"
        data-testid={testId}
        onClick={onExpand}
      >
        <ChevronsUpDown data-icon="inline-start" aria-hidden="true" />
        {t(ACTIVITY_TEXT.commit.expandLines, { count })}
      </Button>
      {header && <span className="truncate">{header}</span>}
    </div>
  )
}

function LineText({ line }: { line: DiffLine }) {
  // Segments are keyed by where they start in the line, which is unique and stable.
  let start = 0
  const keyed = line.segments.map((segment) => {
    const item = { key: start, segment }
    start += segment.text.length
    return item
  })
  return (
    <>
      {keyed.map(({ key, segment }) => (
        <span key={key} className={cn(segment.changed && cn('rounded-sm', WORD_TONE[line.kind]))}>
          {segment.text}
        </span>
      ))}
    </>
  )
}

function UnifiedLine({ line }: { line: DiffLine }) {
  return (
    <div className={cn('grid grid-cols-[3rem_3rem_1.25rem_minmax(0,1fr)]', LINE_TONE[line.kind])} data-kind={line.kind}>
      <span className={cn('px-2 text-right select-none', GUTTER_TONE[line.kind])}>{line.oldLine ?? ''}</span>
      <span className={cn('px-2 text-right select-none', GUTTER_TONE[line.kind])}>{line.newLine ?? ''}</span>
      <span className="text-center text-foreground/60 select-none">{SIGN[line.kind]}</span>
      <span className="pr-3 break-all whitespace-pre-wrap">
        <LineText line={line} />
      </span>
    </div>
  )
}

function SplitCell({ line, side }: { line: DiffLine | null; side: 'old' | 'new' }) {
  if (!line) return <div className="bg-muted/40" />
  const number = side === 'old' ? line.oldLine : line.newLine
  return (
    <div className={cn('grid grid-cols-[3rem_1.25rem_minmax(0,1fr)]', LINE_TONE[line.kind])} data-kind={line.kind}>
      <span className={cn('px-2 text-right select-none', GUTTER_TONE[line.kind])}>{number ?? ''}</span>
      <span className="text-center text-foreground/60 select-none">{SIGN[line.kind]}</span>
      <span className="pr-3 break-all whitespace-pre-wrap">
        <LineText line={line} />
      </span>
    </div>
  )
}
