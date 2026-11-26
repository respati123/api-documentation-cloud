import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, FieldTitle, FieldDescription } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ApiNode, Commit } from '../models/portal.model'
import type { PortalViewModel } from '../hooks/use-portal.viewmodel'
import { CollectionsView } from './collections.view'
import { EmptyView, ErrorView, LoadingView } from './state.view'
import { SummaryCard } from './summary-card.view'
import { WorkspaceTeamView } from './workspace-team.view'
import { WorkspaceSettingsView } from './workspace-settings.view'
import { AdminMcpKeysView, MyMcpKeysView } from './mcp-keys.view'
import { AdminUsersView } from './admin-users.view'
import { AdminWorkspacesView } from './admin-workspaces.view'

function summarizeTree(nodes: ApiNode[]) {
  let folders = 0
  const requests: ApiNode[] = []

  const visit = (items: ApiNode[]) => {
    for (const node of items) {
      if (node.kind === 'folder') {
        folders += 1
        visit(node.children ?? [])
      } else {
        requests.push(node)
      }
    }
  }

  visit(nodes)
  return { folders, requests }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function WorkspaceView({ vm }: { vm: PortalViewModel }) {
  const { t } = useTranslation()
  const snapshot = vm.snapshot.data
  const workspace = snapshot ?? vm.items.find(item => item.id === vm.workspaceId)
  const canManageSettings = workspace?.role === 'owner'
  const treeSummary = summarizeTree(snapshot?.tree ?? [])
  const members = vm.team.members.data?.pages.flatMap(page => page.items) ?? []
  const commits = vm.history.data?.pages.flatMap(page => page.items) ?? []
  const branchCommits = vm.branchHistory.data?.pages.flatMap(page => page.items) ?? []
  const activeBranch = vm.branches.find(branch => branch.id === vm.branchId)
  const dateValue = workspace?.updatedAt ? formatDate(workspace.updatedAt) : t('workspace.notSynced')
  const dateDetail = workspace?.updatedAt ? t('workspace.latestChange') : t('workspace.noSavedChanges')
  const roleValue = workspace?.role ? t(`roleTitle.${workspace.role}`) : t('common.unknown')

  return (
    <FieldGroup className="gap-5" data-testid="workspace-view-container">
      {snapshot?.adminView && (
        <Alert role="status" data-testid="workspace-admin-view-notice">
          <AlertDescription>{t('admin.readOnlyNotice')}</AlertDescription>
        </Alert>
      )}
      {vm.tab === 'overview' && (
        <>
          {vm.snapshot.isPending ? (
              <FieldGroup className="grid gap-4 grid-cols-1 min-[390px]:grid-cols-2 xl:grid-cols-4" role="status">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </FieldGroup>
          ) : vm.snapshot.error ? (
            <ErrorView error={vm.snapshot.error} retry={() => void vm.snapshot.refetch()} />
          ) : vm.snapshot.isSuccess && workspace ? (
            <FieldGroup className="grid gap-4 grid-cols-1 min-[390px]:grid-cols-2 xl:grid-cols-4" aria-label={t('workspace.summaryAria')}>
              <SummaryCard
                label={t('workspace.folders')}
                value={treeSummary.folders}
                detail={t('workspace.foldersDetail')}
              />
              <SummaryCard
                label={t('workspace.requests')}
                value={treeSummary.requests.length}
                detail={t('workspace.requestsDetail')}
              />
              <SummaryCard
                label={t('workspace.yourRole')}
                value={roleValue}
                detail={t('workspace.roleDetail')}
              />
              <SummaryCard
                label={t('workspace.lastUpdate')}
                value={dateValue}
                detail={dateDetail}
              />
            </FieldGroup>
          ) : null}

          <FieldGroup className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
            <RecentChangesCard vm={vm} commits={commits} />
            <MembersCard vm={vm} members={members} />
          </FieldGroup>
        </>
      )}

      {vm.tab === 'collections' && <CollectionsView vm={vm} />}

      {vm.tab === 'team' && <WorkspaceTeamView vm={vm} />}
      {vm.tab === 'mcp-key' && <MyMcpKeysView vm={vm.mcpKeys} />}
      {vm.tab === 'admin-workspaces' && (vm.me.data?.isAdmin
        ? <AdminWorkspacesView vm={vm.adminWorkspaces} />
        : <EmptyView title={t('admin.accessRequired')} description={t('admin.accessRequiredDescription')} />)}
      {vm.tab === 'admin-users' && (vm.me.data?.isAdmin
        ? <AdminUsersView vm={vm.adminUsers} />
        : <EmptyView title={t('admin.accessRequired')} description={t('admin.accessRequiredDescription')} />)}
      {vm.tab === 'admin-mcp-keys' && (vm.me.data?.isAdmin
        ? <AdminMcpKeysView vm={vm.mcpKeys} />
        : <EmptyView title={t('workspace.adminRequired')} description={t('workspace.adminRequiredDescription')} />)}
      {vm.tab === 'settings' && (canManageSettings && workspace
        ? <WorkspaceSettingsView vm={vm} workspaceName={workspace.name} />
        : <EmptyView title={t('workspace.ownerRequired')} description={t('workspace.ownerRequiredDescription')} />)}

      {vm.tab === 'history' && (
        <Card className="rounded-lg py-0 shadow-none">
          <CardContent className="space-y-4 px-0 py-4">
            {snapshot?.usesBranches ? (
              !vm.branches.length ? (
                <EmptyView title={t('workspace.noBranches')} description={t('workspace.noBranchesDescription')} />
              ) : (
                <FieldGroup className="gap-4 px-4">
                  <FieldGroup className="max-w-md gap-2">
                    <FieldTitle>{t('workspace.collectionBranch')}</FieldTitle>
                    <Select value={vm.branchId} onValueChange={vm.setBranchId}>
                      <SelectTrigger aria-label={t('workspace.chooseBranchAria')} data-testid="history-branch-select">
                        <SelectValue placeholder={t('workspace.choosePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {vm.branches.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.collectionKey} · {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {activeBranch && (
                      <CardDescription className="font-medium text-foreground">
                        {t('workspace.historyFor', { branch: `${activeBranch.collectionKey} · ${activeBranch.name}` })}
                      </CardDescription>
                    )}
                  </FieldGroup>
                  {vm.branchHistory.isPending ? (
                    <LoadingView />
                  ) : vm.branchHistory.error ? (
                    <ErrorView error={vm.branchHistory.error} retry={() => void vm.branchHistory.refetch()} />
                  ) : !branchCommits.length ? (
                    <EmptyView title={t('workspace.noBranchChanges')} description={t('workspace.noBranchChangesDescription')} />
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('table.change')}</TableHead>
                            <TableHead>{t('table.author')}</TableHead>
                            <TableHead>{t('table.date')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {branchCommits.map(commit => (
                            <TableRow key={commit.id} data-testid={`branch-commit-${commit.id}`}>
                              <TableCell>{commit.message}</TableCell>
                              <TableCell>{commit.authorEmail}</TableCell>
                              <TableCell>{formatDate(commit.createdAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {vm.branchHistory.hasNextPage && (
                        <Button
                          variant="outline"
                          className="mx-4 w-[calc(100%-2rem)] cursor-pointer"
                          disabled={vm.branchHistory.isFetchingNextPage}
                          onClick={() => void vm.branchHistory.fetchNextPage()}
                          data-testid="branch-history-more-button"
                        >
                          {vm.branchHistory.isFetchingNextPage ? t('common.loadingEllipsis') : t('workspace.loadMoreChanges')}
                        </Button>
                      )}
                    </>
                  )}
                </FieldGroup>
              )
            ) : vm.snapshot.error ? (
              <ErrorView error={vm.snapshot.error} retry={() => void vm.snapshot.refetch()} />
            ) : vm.history.isPending ? (
              <LoadingView />
            ) : vm.history.error ? (
              <ErrorView error={vm.history.error} retry={() => void vm.history.refetch()} />
            ) : !commits.length ? (
              <EmptyView
                title={t('workspace.noCommits')}
                description={t('workspace.noCommitsDescription')}
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('table.change')}</TableHead>
                      <TableHead>{t('table.author')}</TableHead>
                      <TableHead>{t('table.date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commits.map(commit => (
                      <TableRow key={commit.id} data-testid={`workspace-commit-${commit.id}`}>
                        <TableCell>{commit.message}</TableCell>
                        <TableCell>{commit.authorEmail}</TableCell>
                        <TableCell>{formatDate(commit.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {vm.history.hasNextPage && (
                  <Button
                    variant="outline"
                    className="mx-4 w-[calc(100%-2rem)] cursor-pointer"
                    disabled={vm.history.isFetchingNextPage}
                    onClick={() => void vm.history.fetchNextPage()}
                    data-testid="history-more-button"
                  >
                    {vm.history.isFetchingNextPage ? t('common.loadingEllipsis') : t('workspace.loadMoreChanges')}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {(vm.tab === 'design-ui' || vm.tab === 'design-database' || vm.tab === 'projects') && (
        <FieldDescription data-testid={`workspace-${vm.tab}-coming-soon`}>
          {t('workspace.notAvailable')}
        </FieldDescription>
      )}
    </FieldGroup>
  )
}

function RecentChangesCard({ vm, commits }: { vm: PortalViewModel; commits: Commit[] }) {
  const { t } = useTranslation()
  return (
    <Card className="min-w-0 gap-4 rounded-lg p-4 shadow-none">
      <CardHeader className="flex min-w-0 flex-row items-center justify-between gap-3 px-0 py-0">
        <FieldGroup className="min-w-0 flex-1 gap-1">
          <CardTitle className="text-base">{t('workspace.recentChanges')}</CardTitle>
        </FieldGroup>
        <Button
          type="button"
          variant="link"
          className="min-h-11 shrink-0 cursor-pointer px-2 py-1"
          onClick={() => vm.setTab('history')}
          data-testid="workspace-see-history-button"
        >
          {t('workspace.seeAll')}
        </Button>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3 px-0">
        {vm.snapshot.data?.usesBranches ? (
          <CardDescription>{t('workspace.branchesHint')}</CardDescription>
        ) : vm.snapshot.error ? (
          <CardDescription role="alert">{t('workspace.loadSnapshotToView')}</CardDescription>
        ) : vm.history.isPending ? (
          <Skeleton className="h-20 w-full" aria-label={t('workspace.loadRecentAria')} />
        ) : vm.history.error ? (
          <CardDescription role="alert">{t('workspace.recentChangesError')}</CardDescription>
        ) : !commits.length ? (
          <CardDescription>{t('workspace.noSavedChangesDot')}</CardDescription>
        ) : (
          commits.slice(0, 3).map(commit => (
            <FieldGroup
              key={commit.id}
              className="gap-1 border-b border-border/70 pb-3 last:border-0 last:pb-0"
            >
              <CardTitle className="line-clamp-2 text-sm font-medium">{commit.message}</CardTitle>
              <CardDescription className="text-xs">
                {commit.authorEmail} · {formatDate(commit.createdAt)}
              </CardDescription>
            </FieldGroup>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function MembersCard({ vm, members }: { vm: PortalViewModel; members: Array<{ id: string; email: string; role: string }> }) {
  const { t } = useTranslation()
  return (
    <Card className="min-w-0 gap-4 rounded-lg p-4 shadow-none">
      <CardHeader className="flex min-w-0 flex-row items-center justify-between gap-3 px-0 py-0">
        <FieldGroup className="min-w-0 flex-1 gap-1">
          <CardTitle className="text-base">{t('workspace.members')}</CardTitle>
          <CardDescription className="text-xs">{t('workspace.peopleWithAccess')}</CardDescription>
        </FieldGroup>
        <Button
          type="button"
          variant="link"
          className="min-h-11 shrink-0 cursor-pointer px-2 py-1"
          onClick={() => vm.setTab('team')}
          data-testid="workspace-see-members-button"
        >
          {t('workspace.seeAll')}
        </Button>
      </CardHeader>
      <CardContent className="min-w-0 space-y-2 px-0">
        {vm.team.members.isPending ? (
          <Skeleton className="h-20 w-full" aria-label={t('workspace.loadingMembersAria')} />
        ) : vm.team.members.error ? (
          <CardDescription role="alert">{t('workspace.membersError')}</CardDescription>
        ) : !members.length ? (
          <CardDescription>{t('workspace.noMembers')}</CardDescription>
        ) : (
          members.slice(0, 4).map(member => (
            <FieldGroup
              key={member.id}
              className="flex-row items-center justify-between gap-3 border-b border-border/70 py-2 last:border-0"
            >
              <FieldGroup className="w-auto min-w-0 flex-1 flex-row items-center gap-2">
                <CardDescription className="truncate text-xs text-foreground">
                  {member.email}
                </CardDescription>
              </FieldGroup>
              <Badge variant="outline" className="shrink-0">{t(`role.${member.role}`)}</Badge>
            </FieldGroup>
          ))
        )}
      </CardContent>
    </Card>
  )
}
