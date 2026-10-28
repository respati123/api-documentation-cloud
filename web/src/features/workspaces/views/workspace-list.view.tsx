import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/components/ui/empty'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { COMMON_TEXT } from '@/shared/constants/common-text.constants'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'
import { WORKSPACES_ROLE_TEXT, WORKSPACES_TEXT } from '../constants/workspaces-text.constants'
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
      <Alert variant="destructive" data-testid="workspaces-error-state">
        <AlertTitle>{t(COMMON_TEXT.error.title)}</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
        <Button variant="outline" className="mt-2 justify-self-start" data-testid="workspaces-retry-button" onClick={onRetry}>
          {t(COMMON_TEXT.error.retry)}
        </Button>
      </Alert>
    )
  }

  if (status === 'empty') {
    return (
      <Empty data-testid="workspaces-empty-state" className="border border-dashed border-border">
        <EmptyHeader>
          <EmptyTitle>{t(WORKSPACES_TEXT.list.emptyTitle)}</EmptyTitle>
          <EmptyDescription>{t(WORKSPACES_TEXT.list.emptyDetail)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button data-testid="workspaces-empty-create-button" onClick={onCreate}>
            {t(WORKSPACES_TEXT.list.create)}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <Table data-testid="workspaces-list-container">
        <TableHeader>
          <TableRow>
            <TableHead>{t(WORKSPACES_TEXT.list.columns.workspace)}</TableHead>
            <TableHead>{t(WORKSPACES_TEXT.list.columns.role)}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t(WORKSPACES_TEXT.list.columns.action)}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workspaces.map((workspace) => (
            <TableRow key={workspace.id}>
              <TableCell className="truncate font-medium">{workspace.name}</TableCell>
              <TableCell className="text-muted-foreground">{t(WORKSPACES_ROLE_TEXT[workspace.role])}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" data-testid={`workspaces-row-${workspace.id}`} onClick={() => onOpen(workspace.id)}>
                  {t(WORKSPACES_TEXT.list.open)}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
