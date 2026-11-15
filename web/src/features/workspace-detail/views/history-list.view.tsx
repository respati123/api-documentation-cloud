import { ChevronRight, GitCommitHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ACTIVITY_TEXT } from '@/features/workspace-detail/constants/activity-text.constants'
import type { CommitDayGroup } from '@/features/workspace-detail/models/history.model'
import { CopyButton } from '@/shared/components/copy-button'
import { LoadMoreButton } from '@/shared/components/load-more-button'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { EmptyState } from '@/shared/components/state-views'

export interface HistoryListViewProps {
  dayGroups: CommitDayGroup[]
  commitCount: number
  usesBranches: boolean
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  onOpenCommit: (commitId: string) => void
}

export function HistoryListView({
  dayGroups,
  commitCount,
  usesBranches,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onOpenCommit,
}: HistoryListViewProps) {
  const { t } = useTranslation('activity')

  if (usesBranches) {
    return (
      <EmptyState title={t(ACTIVITY_TEXT.empty.branchTitle)} detail={t(ACTIVITY_TEXT.empty.branchDetail)} testId="history-empty-state" />
    )
  }
  if (commitCount === 0) {
    return <EmptyState title={t(ACTIVITY_TEXT.empty.title)} detail={t(ACTIVITY_TEXT.empty.detail)} testId="history-empty-state" />
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6" data-testid="history-list-container">
      <p className="text-sm text-muted-foreground" data-testid="history-list-count">
        {t(ACTIVITY_TEXT.list.count, { count: commitCount })}
      </p>
      <ol className="grid gap-6">
        {dayGroups.map((group) => (
          <li key={group.key} className="grid gap-2" data-testid={`history-day-${group.key}`}>
            <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <GitCommitHorizontal aria-hidden="true" className="size-4" />
              {t(ACTIVITY_TEXT.list.day, { date: group.label })}
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {group.commits.map((commit) => (
                <li key={commit.id} className="flex items-center gap-3 px-4 py-3" data-testid={`history-commit-${commit.id}`}>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <Button
                        variant="link"
                        className="h-auto min-w-0 justify-start p-0 text-sm font-semibold text-foreground"
                        data-testid={`history-commit-${commit.id}-title`}
                        onClick={() => onOpenCommit(commit.id)}
                      >
                        <span className="truncate">{commit.message}</span>
                      </Button>
                      {commit.isLatest && (
                        <Badge variant="secondary" data-testid={`history-commit-${commit.id}-latest`}>
                          {t(ACTIVITY_TEXT.list.latest)}
                        </Badge>
                      )}
                    </div>
                    <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      <span
                        aria-hidden="true"
                        className="grid size-4 place-items-center rounded-full bg-secondary text-[10px] font-semibold"
                      >
                        {(commit.authorEmail[0] ?? '?').toUpperCase()}
                      </span>
                      <span className="truncate font-medium text-foreground/80">
                        {commit.authorEmail || t(ACTIVITY_TEXT.list.unknownAuthor)}
                      </span>
                      <span>{commit.when}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <CopyButton
                      value={commit.id}
                      label={commit.shortId}
                      copiedLabel={t(ACTIVITY_TEXT.list.copied)}
                      ariaLabel={t(ACTIVITY_TEXT.list.copyId)}
                      testId={`history-commit-${commit.id}-copy`}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t(ACTIVITY_TEXT.list.open, { id: commit.shortId })}
                      data-testid={`history-commit-${commit.id}-open`}
                      onClick={() => onOpenCommit(commit.id)}
                    >
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <LoadMoreButton hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={onLoadMore} testId="history-load-more" />
    </div>
  )
}
