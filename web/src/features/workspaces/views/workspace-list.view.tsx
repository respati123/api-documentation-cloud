import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'
import type { WorkspaceListStatus } from '../models/workspaces.model'

const skeletonRows = ['first', 'second', 'third']

export interface WorkspaceListViewProps {
  status: WorkspaceListStatus
  workspaces: CloudWorkspaceRef[]
  errorMessage: string | null
  onOpen: (workspaceId: string) => void
  onCreate: () => void
  onRetry: () => void
}

export function WorkspaceListView({ status, workspaces, errorMessage, onOpen, onCreate, onRetry }: WorkspaceListViewProps) {
  const { t } = useTranslation(['workspaces', 'common'])

  if (status === 'loading') {
    return (
      <div data-testid="workspaces-loading-state" className="grid gap-2" aria-busy="true">
        {skeletonRows.map((row) => (
          <Skeleton key={row} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div data-testid="workspaces-error-state" role="alert" className="grid justify-items-start gap-3 rounded-md border border-border p-4">
        <p className="text-sm font-medium">{t('common:error.title')}</p>
        <p className="text-xs text-muted-foreground">{errorMessage}</p>
        <Button variant="outline" data-testid="workspaces-retry-button" onClick={onRetry}>
          {t('common:error.retry')}
        </Button>
      </div>
    )
  }

  if (status === 'empty') {
    return (
      <div
        data-testid="workspaces-empty-state"
        className="grid justify-items-start gap-3 rounded-md border border-dashed border-border p-6"
      >
        <p className="text-sm font-medium">{t('list.emptyTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('list.emptyDetail')}</p>
        <Button data-testid="workspaces-empty-create-button" onClick={onCreate}>
          {t('list.create')}
        </Button>
      </div>
    )
  }

  return (
    <ul data-testid="workspaces-list-container" className="grid gap-2">
      {workspaces.map((workspace) => (
        <li key={workspace.id}>
          <button
            type="button"
            data-testid={`workspaces-row-${workspace.id}`}
            className="flex w-full items-center justify-between gap-4 rounded-md border border-border bg-card p-3 text-left hover:bg-accent"
            onClick={() => onOpen(workspace.id)}
          >
            <span className="grid min-w-0 gap-1">
              <span className="truncate text-sm font-medium">{workspace.name}</span>
              <span className="text-xs text-muted-foreground">{t(`roles.${workspace.role}`)}</span>
            </span>
            <span className="text-xs text-muted-foreground">{t('list.open')}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
