import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ADMIN_WORKSPACES_TEXT } from '@/features/admin-workspaces/constants/admin-workspaces-text.constants'
import type { useAdminWorkspacesViewModel } from '@/features/admin-workspaces/viewmodels/use-admin-workspaces.viewmodel'
import { LoadMoreButton } from '@/shared/components/load-more-button'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Card } from '@/shared/components/primitives/card'
import { Input } from '@/shared/components/primitives/input'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/primitives/table'
import { formatDate } from '@/shared/utils/format'

export type AdminWorkspacesViewProps = ReturnType<typeof useAdminWorkspacesViewModel>

export function AdminWorkspacesView(vm: AdminWorkspacesViewProps) {
  const { t, i18n } = useTranslation('admin')

  return (
    <div className="grid max-w-6xl gap-6" data-testid="admin-workspaces-page">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t(ADMIN_WORKSPACES_TEXT.title)}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t(ADMIN_WORKSPACES_TEXT.subtitle)}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            className="pl-8"
            data-testid="admin-workspaces-search"
            aria-label={t(ADMIN_WORKSPACES_TEXT.search)}
            placeholder={t(ADMIN_WORKSPACES_TEXT.search)}
            value={vm.search}
            onChange={(event) => vm.setSearch(event.target.value)}
          />
        </div>
      </header>

      {vm.error && (
        <Alert variant="destructive">
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <Table data-testid="admin-workspaces-table">
          <TableHeader>
            <TableRow>
              <TableHead>{t(ADMIN_WORKSPACES_TEXT.name)}</TableHead>
              <TableHead className="hidden md:table-cell">{t(ADMIN_WORKSPACES_TEXT.owner)}</TableHead>
              <TableHead className="text-right">{t(ADMIN_WORKSPACES_TEXT.members)}</TableHead>
              <TableHead className="hidden text-right lg:table-cell">{t(ADMIN_WORKSPACES_TEXT.created)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vm.status === 'loading' &&
              [0, 1, 2].map((row) => (
                <TableRow key={row}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {vm.status === 'empty' && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  {t(ADMIN_WORKSPACES_TEXT.empty)}
                </TableCell>
              </TableRow>
            )}
            {vm.status === 'ready' &&
              vm.workspaces.map((workspace) => (
                <TableRow key={workspace.id} data-testid={`admin-workspaces-row-${workspace.id}`}>
                  <TableCell className="max-w-72">
                    <span className="block truncate font-medium">{workspace.name}</span>
                    <span className="block truncate text-xs text-muted-foreground md:hidden">{workspace.ownerEmail}</span>
                  </TableCell>
                  <TableCell className="hidden max-w-64 truncate text-muted-foreground md:table-cell">{workspace.ownerEmail}</TableCell>
                  <TableCell className="text-right tabular-nums">{workspace.memberCount}</TableCell>
                  <TableCell className="hidden text-right text-muted-foreground lg:table-cell">
                    {formatDate(workspace.createdAt, i18n.language)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>
      <LoadMoreButton hasMore={vm.hasMore} isLoading={vm.isLoadingMore} onLoadMore={vm.loadMore} testId="admin-workspaces-load-more" />
      <p className="text-xs text-muted-foreground">{t(ADMIN_WORKSPACES_TEXT.privacy)}</p>
    </div>
  )
}
