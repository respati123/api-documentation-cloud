import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, FieldDescription } from '@/components/ui/field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { PortalViewModel } from '../hooks/use-portal.viewmodel'
import { EmptyView } from './state.view'
import { SummaryCard } from './summary-card.view'

export function WorkspaceDirectoryView({ vm }: { vm: PortalViewModel }) {
  const { t } = useTranslation()
  const visibleWorkspaces = vm.items.filter(workspace =>
    workspace.name.toLowerCase().includes(vm.search.toLowerCase()),
  )
  const recentWorkspaces = [...visibleWorkspaces]
    .sort((left, right) => {
      const leftDate = new Date(left.updatedAt ?? left.createdAt).getTime()
      const rightDate = new Date(right.updatedAt ?? right.createdAt).getTime()
      return rightDate - leftDate
    })
    .slice(0, 5)
  const ownerCount = vm.items.filter(workspace => workspace.role === 'owner').length
  const editorCount = vm.items.filter(workspace => workspace.role === 'editor').length
  const viewerCount = vm.items.filter(workspace => workspace.role === 'viewer').length

  return (
    <FieldGroup className="gap-6">
      <FieldGroup className="grid grid-cols-1 gap-4 min-[390px]:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={t('dir.loaded')}
          value={vm.items.length}
          detail={vm.workspaces.hasNextPage ? t('dir.moreAvailable') : t('dir.accessible')}
        />
        <SummaryCard label={t('dir.ownerAccess')} value={ownerCount} detail={t('dir.ownerRole')} />
        <SummaryCard label={t('dir.editorAccess')} value={editorCount} detail={t('dir.editorRole')} />
        <SummaryCard label={t('dir.viewerAccess')} value={viewerCount} detail={t('dir.viewerRole')} />
      </FieldGroup>

      {vm.workspaces.hasNextPage && (
        <FieldDescription className="-mt-3 text-xs">
          {t('dir.countsNote')}
        </FieldDescription>
      )}

      <FieldGroup className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card className="min-w-0 gap-4 rounded-lg py-0 shadow-none">
          <CardHeader className="px-4 pt-4">
            <CardTitle className="text-base">{t('dir.yourWorkspaces')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            {visibleWorkspaces.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dir.colName')}</TableHead>
                    <TableHead>{t('dir.colRole')}</TableHead>
                    <TableHead>{t('dir.updated')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleWorkspaces.map(workspace => (
                    <TableRow key={workspace.id} data-testid={`workspace-row-${workspace.id}`}>
                      <TableCell>
                        <Button
                          variant="link"
                          className="h-auto cursor-pointer px-0 text-left text-foreground"
                          aria-label={t('dir.open', { name: workspace.name })}
                          onClick={() => vm.openWorkspace(workspace.id)}
                          data-testid={`workspace-open-${workspace.id}`}
                        >
                          {workspace.name}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{t(`role.${workspace.role}`)}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(workspace.updatedAt ?? workspace.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyView
                title={t('dir.noMatch')}
                description={t('dir.noMatchDescription')}
              />
            )}
            {vm.workspaces.hasNextPage && (
              <Button
                variant="outline"
                className="mx-4 w-[calc(100%-2rem)] cursor-pointer"
                disabled={vm.workspaces.isFetchingNextPage}
                onClick={() => void vm.workspaces.fetchNextPage()}
                data-testid="workspace-more-button"
              >
                {vm.workspaces.isFetchingNextPage ? t('common.loadingEllipsis') : t('dir.loadMore')}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="gap-4 rounded-lg p-4 shadow-none">
          <CardHeader className="px-0 py-0">
            <CardTitle className="text-base">{t('dir.recent')}</CardTitle>
            <CardDescription>{t('dir.recentDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 px-0">
            {recentWorkspaces.length ? (
              recentWorkspaces.map(workspace => (
                <FieldGroup key={workspace.id} className="gap-1 border-b border-border/70 pb-3 last:border-0">
                  <FieldGroup className="flex-row items-center gap-2">
                    <Button
                      variant="ghost"
                      className="h-auto min-h-11 min-w-0 flex-1 justify-start gap-3 whitespace-normal rounded-md p-3 text-left"
                      aria-label={t('dir.open', { name: workspace.name })}
                      onClick={() => vm.openWorkspace(workspace.id)}
                      data-testid={`recent-workspace-open-${workspace.id}`}
                    >
                      {workspace.name}
                      <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Button>
                    <Badge variant="outline" className="shrink-0">{t(`role.${workspace.role}`)}</Badge>
                  </FieldGroup>
                  <CardDescription className="pl-3 text-xs">
                    {workspace.updatedAt ? t('dir.updated') : t('dir.created')}{' '}
                    {new Date(workspace.updatedAt ?? workspace.createdAt).toLocaleDateString()}
                  </CardDescription>
                </FieldGroup>
              ))
            ) : (
              <EmptyView
                title={t('dir.noRecent')}
                description={t('dir.noRecentDescription')}
              />
            )}
          </CardContent>
        </Card>
      </FieldGroup>
    </FieldGroup>
  )
}
