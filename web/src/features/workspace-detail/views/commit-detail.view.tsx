import { ArrowLeft, ChevronDown, ChevronRight, Folder, FolderTree } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  ACTIVITY_KIND_SHORT_TEXT,
  ACTIVITY_KIND_TEXT,
  ACTIVITY_TEXT,
  DIFF_LAYOUT_TEXT,
} from '@/features/workspace-detail/constants/activity-text.constants'
import type { ChangeTreeGroup, DiffLayout, DiffStats, FileDiff } from '@/features/workspace-detail/models/history.model'
import { fileAnchorId } from '@/features/workspace-detail/utils/commit-history'
import type { ChangeKind } from '@/features/workspace-detail/utils/snapshot-diff'
import { DiffView } from '@/features/workspace-detail/views/diff-view.view'
import { methodVariant } from '@/features/workspace-detail/views/method-badge'
import { CopyButton } from '@/shared/components/copy-button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/primitives/alert-dialog'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Checkbox } from '@/shared/components/primitives/checkbox'
import { Label } from '@/shared/components/primitives/label'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { EmptyState, ErrorState } from '@/shared/components/state-views'
import { cn } from '@/shared/utils/cn'

export interface CommitHeader {
  id: string
  shortId: string
  message: string
  authorEmail: string
  when: string
  date: string
  parentId: string | null
  parentShortId: string | null
  isLatest: boolean
}

export interface CommitDetailViewProps {
  commit: CommitHeader
  status: 'loading' | 'error' | 'ready'
  error: string | null
  files: FileDiff[]
  tree: ChangeTreeGroup[]
  totals: DiffStats & { files: number }
  layout: DiffLayout
  diffLayout: DiffLayout
  canChooseLayout: boolean
  viewedIds: string[]
  collapsedIds: string[]
  expandedGapKeys: string[]
  canRestore: boolean
  onBack: () => void
  onOpenCommit: (commitId: string) => void
  onRetry: () => void
  onLayoutChange: (layout: DiffLayout) => void
  onToggleViewed: (fileId: string) => void
  onToggleCollapsed: (fileId: string) => void
  onExpandGap: (fileId: string, gapId: string) => void
  onJumpToFile: (fileId: string) => void
  onRestore: () => void
}

const KIND_TONE: Record<ChangeKind, string> = {
  added: 'border-success/40 bg-success/10 text-success',
  modified: 'border-diff-modify/40 bg-diff-modify/10 text-diff-modify',
  deleted: 'border-destructive/40 bg-destructive/10 text-destructive',
}

const LAYOUTS: DiffLayout[] = ['split', 'unified']
const STAT_SQUARES = ['s1', 's2', 's3', 's4', 's5'] as const

export function CommitDetailView(props: CommitDetailViewProps) {
  const { t } = useTranslation('activity')
  const { commit, status, files, totals } = props

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5" data-testid="history-commit-container">
      <Button variant="ghost" size="sm" className="justify-self-start px-2" data-testid="history-commit-back" onClick={props.onBack}>
        <ArrowLeft data-icon="inline-start" aria-hidden="true" />
        {t(ACTIVITY_TEXT.commit.back)}
      </Button>

      <section
        className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border border-border bg-card p-4"
        data-testid="history-commit-header"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="min-w-0 font-heading text-xl font-semibold tracking-tight break-words" data-testid="history-commit-message">
            {commit.message}
          </h2>
          {props.canRestore && <RestoreDialog disabled={commit.isLatest} onConfirm={props.onRestore} />}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm">
          <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <span
              aria-hidden="true"
              className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
            >
              {(commit.authorEmail[0] ?? '?').toUpperCase()}
            </span>
            <span className="truncate">
              {t(ACTIVITY_TEXT.commit.committed, { author: commit.authorEmail || t(ACTIVITY_TEXT.list.unknownAuthor), when: commit.when })}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {commit.parentId && commit.parentShortId && (
              <span className="flex items-center gap-1">
                {t(ACTIVITY_TEXT.commit.parent)}
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 font-mono text-xs"
                  data-testid="history-commit-parent"
                  onClick={() => commit.parentId && props.onOpenCommit(commit.parentId)}
                >
                  {commit.parentShortId}
                </Button>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              {t(ACTIVITY_TEXT.commit.commitId)}
              <CopyButton
                value={commit.id}
                label={commit.shortId}
                copiedLabel={t(ACTIVITY_TEXT.list.copied)}
                ariaLabel={t(ACTIVITY_TEXT.list.copyId)}
                testId="history-commit-copy"
              />
            </span>
          </div>
        </div>
      </section>

      {status === 'loading' && <CommitSkeleton />}
      {status === 'error' && (
        <ErrorState
          title={t(ACTIVITY_TEXT.detail.errorTitle)}
          message={props.error ?? ''}
          retryLabel={t(ACTIVITY_TEXT.actions.retry)}
          onRetry={props.onRetry}
          testId="history-commit-error"
        />
      )}
      {status === 'ready' && files.length === 0 && (
        <EmptyState
          title={t(ACTIVITY_TEXT.detail.noChangesTitle)}
          detail={t(ACTIVITY_TEXT.detail.noChangesDetail)}
          testId="history-commit-empty"
        />
      )}
      {status === 'ready' && files.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground" data-testid="history-commit-summary">
              {t(ACTIVITY_TEXT.commit.summary, { count: totals.files })}
              <StatNumbers stats={totals} />
            </p>
            {props.canChooseLayout && (
              <fieldset
                className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5"
                data-testid="history-layout-toggle"
              >
                <legend className="sr-only">{t(ACTIVITY_TEXT.layout.label)}</legend>
                {LAYOUTS.map((option) => (
                  <Button
                    key={option}
                    variant="ghost"
                    size="sm"
                    aria-pressed={props.layout === option}
                    className={cn('h-7', props.layout === option && 'bg-muted text-foreground')}
                    data-testid={`history-layout-${option}`}
                    onClick={() => props.onLayoutChange(option)}
                  >
                    {t(DIFF_LAYOUT_TEXT[option])}
                  </Button>
                ))}
              </fieldset>
            )}
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <ChangeTree tree={props.tree} onJumpToFile={props.onJumpToFile} />
            <div className="grid min-w-0 gap-4">
              {files.map((file) => (
                <FileCard key={file.id} file={file} {...props} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatNumbers({ stats }: { stats: DiffStats }) {
  const { t } = useTranslation('activity')
  return (
    <span className="flex items-center gap-1.5 font-mono text-xs">
      <span className="text-success" aria-hidden="true">
        {`+${stats.added}`}
      </span>
      <span className="text-destructive" aria-hidden="true">
        {`-${stats.removed}`}
      </span>
      <span className="sr-only">
        {t(ACTIVITY_TEXT.commit.additions, { count: stats.added })}, {t(ACTIVITY_TEXT.commit.deletions, { count: stats.removed })}
      </span>
    </span>
  )
}

// Five squares split between added and removed lines, as in GitHub's diffstat.
function StatBar({ stats }: { stats: DiffStats }) {
  const total = stats.added + stats.removed
  const added = total === 0 ? 0 : Math.round((stats.added / total) * 5)
  const removed = total === 0 ? 0 : 5 - added
  return (
    <span aria-hidden="true" className="flex gap-px">
      {STAT_SQUARES.map((square, index) => (
        <span
          key={square}
          className={cn('size-2 rounded-[1px]', index < added ? 'bg-success' : index < added + removed ? 'bg-destructive' : 'bg-muted')}
        />
      ))}
    </span>
  )
}

function KindMark({ kind }: { kind: ChangeKind }) {
  const { t } = useTranslation('activity')
  return (
    <span
      title={t(ACTIVITY_KIND_TEXT[kind])}
      className={cn('grid size-5 shrink-0 place-items-center rounded border font-mono text-[10px] font-semibold', KIND_TONE[kind])}
    >
      {t(ACTIVITY_KIND_SHORT_TEXT[kind])}
    </span>
  )
}

function ChangeTree({ tree, onJumpToFile }: { tree: ChangeTreeGroup[]; onJumpToFile: (fileId: string) => void }) {
  const { t } = useTranslation('activity')
  return (
    <nav
      aria-label={t(ACTIVITY_TEXT.commit.tree)}
      className="grid gap-3 rounded-lg border border-border bg-card p-3 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
      data-testid="history-change-tree"
    >
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <FolderTree aria-hidden="true" className="size-3.5" />
        {t(ACTIVITY_TEXT.commit.tree)}
      </p>
      {tree.map((group) => (
        <div key={group.id} className="grid gap-0.5">
          <p className="flex min-w-0 items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <Folder aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{group.path.length ? group.path.join(' / ') : t(ACTIVITY_TEXT.commit.root)}</span>
          </p>
          {group.files.map((file) => (
            <Button
              key={file.id}
              variant="ghost"
              size="sm"
              className="h-auto justify-start gap-2 py-1 pl-5 font-normal"
              aria-label={t(ACTIVITY_TEXT.commit.jumpTo, { name: file.name })}
              data-testid={`history-tree-${file.id}`}
              onClick={() => onJumpToFile(file.id)}
            >
              <KindMark kind={file.kind} />
              <span className="min-w-0 flex-1 truncate text-left">{file.name}</span>
            </Button>
          ))}
        </div>
      ))}
    </nav>
  )
}

function FileCard({
  file,
  diffLayout,
  viewedIds,
  collapsedIds,
  expandedGapKeys,
  onToggleViewed,
  onToggleCollapsed,
  onExpandGap,
}: CommitDetailViewProps & { file: FileDiff }) {
  const { t } = useTranslation('activity')
  const collapsed = collapsedIds.includes(file.id)
  const viewed = viewedIds.includes(file.id)
  const checkboxId = `history-viewed-${file.id}`

  return (
    <section
      id={fileAnchorId(file.id)}
      className="scroll-mt-20 overflow-hidden rounded-lg border border-border bg-card"
      data-testid={`history-file-${file.id}`}
      data-kind={file.kind}
    >
      <header className={cn('flex flex-wrap items-center gap-2 bg-muted/40 px-2 py-1.5', !collapsed && 'border-b border-border')}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-expanded={!collapsed}
          aria-label={t(collapsed ? ACTIVITY_TEXT.commit.expand : ACTIVITY_TEXT.commit.collapse, { name: file.name })}
          data-testid={`history-file-${file.id}-toggle`}
          onClick={() => onToggleCollapsed(file.id)}
        >
          {collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </Button>
        <KindMark kind={file.kind} />
        {file.nodeKind === 'request' ? (
          <Badge variant={methodVariant(file.method)} className="font-mono">
            {file.method}
          </Badge>
        ) : (
          <Badge variant="outline">{t(ACTIVITY_TEXT.commit.folder)}</Badge>
        )}
        <div className="grid min-w-0 flex-1">
          <span className="truncate text-sm font-medium">
            {file.path.length > 0 && <span className="text-muted-foreground">{`${file.path.join(' / ')} / `}</span>}
            {file.name}
          </span>
          {file.url && <span className="truncate font-mono text-xs text-muted-foreground">{file.url}</span>}
        </div>
        <div className="flex items-center gap-2">
          <StatNumbers stats={file.stats} />
          <StatBar stats={file.stats} />
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1">
          <Checkbox
            id={checkboxId}
            checked={viewed}
            data-testid={`history-file-${file.id}-viewed`}
            onChange={() => onToggleViewed(file.id)}
          />
          <Label htmlFor={checkboxId} className="text-xs font-normal">
            {t(ACTIVITY_TEXT.commit.viewed)}
          </Label>
        </div>
      </header>
      {!collapsed && (
        <DiffView fileId={file.id} blocks={file.blocks} layout={diffLayout} expandedGapKeys={expandedGapKeys} onExpandGap={onExpandGap} />
      )}
    </section>
  )
}

function CommitSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]" data-testid="history-commit-loading" role="status">
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

function RestoreDialog({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  const { t } = useTranslation('activity')
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            title={disabled ? t(ACTIVITY_TEXT.actions.latest) : undefined}
            data-testid="history-restore-button"
          />
        }
      >
        {t(ACTIVITY_TEXT.actions.restore)}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(ACTIVITY_TEXT.actions.confirmTitle)}</AlertDialogTitle>
          <AlertDialogDescription>{t(ACTIVITY_TEXT.actions.confirmDetail)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t(ACTIVITY_TEXT.actions.cancel)}</AlertDialogCancel>
          <AlertDialogAction data-testid="history-restore-confirm" onClick={onConfirm}>
            {t(ACTIVITY_TEXT.actions.confirm)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
