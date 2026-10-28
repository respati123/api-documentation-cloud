import { useTranslation } from 'react-i18next'
import { EmptyState, LoadingState } from '@/shared/components/state-views'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
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
} from '@/shared/components/ui/alert-dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import type { CloudCommit } from '@/shared/models/cloud-workspace.model'
import { cn } from '@/shared/utils/cn'
import { formatDate } from '@/shared/utils/format'
import { ACTIVITY_KIND_TEXT, ACTIVITY_TEXT } from '../constants/activity-text.constants'
import type { SnapshotChange } from '../utils/snapshot-diff'

export interface ActivityViewProps {
  commits: CloudCommit[]
  canRestore: boolean
  selectedCommit: CloudCommit | null
  latestCommitId: string
  onSelectCommit: (commitId: string) => void
  loading: boolean
  error: string | null
  changes: SnapshotChange[]
  activeChange: SnapshotChange | null
  onSelectChange: (changeId: string) => void
  onRestore: (commitId: string) => void
}

export function ActivityView({
  commits,
  canRestore,
  selectedCommit,
  latestCommitId,
  onSelectCommit,
  loading,
  error,
  changes,
  activeChange,
  onSelectChange,
  onRestore,
}: ActivityViewProps) {
  const { t, i18n } = useTranslation('activity')
  if (!commits.length) {
    return <EmptyState title={t(ACTIVITY_TEXT.empty.title)} detail={t(ACTIVITY_TEXT.empty.detail)} testId="activity-empty-state" />
  }
  const isLatest = selectedCommit?.id === latestCommitId

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start" data-testid="activity-view">
      <Card>
        <CardHeader>
          <CardTitle>{t(ACTIVITY_TEXT.history.title)}</CardTitle>
          <CardDescription>{t(ACTIVITY_TEXT.history.count, { count: commits.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[60vh]">
            <ul className="grid gap-1">
              {commits.map((commit) => (
                <li key={commit.id}>
                  <Button
                    variant="ghost"
                    className={cn('h-auto w-full justify-start py-2 text-left', selectedCommit?.id === commit.id && 'bg-accent')}
                    aria-current={selectedCommit?.id === commit.id ? 'true' : undefined}
                    data-testid={`activity-commit-${commit.id}`}
                    onClick={() => onSelectCommit(commit.id)}
                  >
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate text-sm font-medium">{commit.message}</span>
                      <span className="truncate text-xs text-muted-foreground">{commit.authorEmail}</span>
                      <time dateTime={commit.createdAt} className="text-xs text-muted-foreground">
                        {formatDate(commit.createdAt, i18n.language)}
                      </time>
                    </span>
                    <Badge variant="outline" className="ml-auto shrink-0 font-mono">
                      {commit.id.slice(0, 7)}
                    </Badge>
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card aria-live="polite" className="min-w-0">
        {selectedCommit && (
          <CardHeader>
            <CardTitle className="text-lg">{selectedCommit.message}</CardTitle>
            <CardDescription>
              {selectedCommit.authorEmail} · {formatDate(selectedCommit.createdAt, i18n.language)}
            </CardDescription>
            <div className="flex flex-wrap items-center gap-2">
              {canRestore && <RestoreDialog disabled={isLatest} onConfirm={() => onRestore(selectedCommit.id)} />}
              <Badge variant="outline" className="font-mono">
                {selectedCommit.id.slice(0, 10)}
              </Badge>
            </div>
          </CardHeader>
        )}
        <CardContent className="grid gap-4">
          {loading ? (
            <LoadingState label={t(ACTIVITY_TEXT.detail.loading)} />
          ) : error ? (
            <Alert variant="destructive">
              <AlertTitle>{t(ACTIVITY_TEXT.detail.errorTitle)}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : !changes.length ? (
            <EmptyState title={t(ACTIVITY_TEXT.detail.noChangesTitle)} detail={t(ACTIVITY_TEXT.detail.noChangesDetail)} />
          ) : (
            <>
              <section className="flex flex-wrap gap-2" aria-label={t(ACTIVITY_TEXT.detail.changedItems)}>
                {changes.map((change) => (
                  <Button
                    key={change.id}
                    variant={activeChange?.id === change.id ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => onSelectChange(change.id)}
                  >
                    <Badge variant={change.kind === 'deleted' ? 'destructive' : 'outline'}>{t(ACTIVITY_KIND_TEXT[change.kind])}</Badge>
                    {change.label}
                  </Button>
                ))}
              </section>
              {activeChange && (
                <div className="grid gap-3 md:grid-cols-2">
                  <DiffPane
                    title={t(ACTIVITY_TEXT.detail.previous)}
                    note={activeChange.kind === 'added' ? t(ACTIVITY_TEXT.detail.previousNone) : t(ACTIVITY_TEXT.detail.beforeCommit)}
                    value={activeChange.before}
                  />
                  <DiffPane
                    title={t(ACTIVITY_TEXT.detail.committed)}
                    note={activeChange.kind === 'deleted' ? t(ACTIVITY_TEXT.detail.removed) : t(ACTIVITY_TEXT.detail.afterCommit)}
                    value={activeChange.after}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DiffPane({ title, note, value }: { title: string; note: string; value: string }) {
  const { t } = useTranslation('activity')
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{note}</span>
      </div>
      <ScrollArea className="max-h-96 rounded-md border border-border bg-muted/40">
        <pre className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{value || t(ACTIVITY_TEXT.detail.empty)}</pre>
      </ScrollArea>
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
            data-testid="activity-restore-button"
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
          <AlertDialogAction data-testid="activity-restore-confirm" onClick={onConfirm}>
            {t(ACTIVITY_TEXT.actions.confirm)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
