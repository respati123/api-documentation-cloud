import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel, FieldTitle, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { PortalViewModel } from '../hooks/use-portal.viewmodel'
import type { WorkspaceSection } from '../models/portal.model'
import { AuthView } from './auth.view'
import { PortalSidebar, PortalSidebarTrigger } from './portal-sidebar.view'
import { EmptyView, ErrorView, LoadingView } from './state.view'
import { WorkspaceView } from './workspace.view'
import { WorkspaceDirectoryView } from './workspace-directory.view'

function sectionCopy(t: TFunction): Record<WorkspaceSection, { title: string; description: string }> {
  return {
    overview: { title: t('nav.overview'), description: t('desc.overview') },
    collections: { title: t('nav.collections'), description: t('desc.collections') },
    history: { title: t('nav.history'), description: t('desc.history') },
    'design-ui': { title: t('nav.uiStitchkit'), description: t('desc.uiStitchkit') },
    'design-database': { title: t('nav.databaseDbdesign'), description: t('desc.databaseDbdesign') },
    projects: { title: t('nav.project'), description: t('desc.project') },
    team: { title: t('nav.team'), description: t('desc.team') },
    settings: { title: t('nav.settings'), description: t('desc.settings') },
    'mcp-key': { title: t('nav.myMcpKeys'), description: t('desc.myMcpKeys') },
    'admin-mcp-keys': { title: t('nav.mcpKeyAdmin'), description: t('desc.mcpKeyAdmin') },
    'admin-users': { title: t('nav.adminUsers'), description: t('desc.adminUsers') },
    'admin-workspaces': { title: t('nav.adminWorkspaces'), description: t('desc.adminWorkspaces') },
  }
}

export function PortalView({ vm }: { vm: PortalViewModel }) {
  if (vm.me.isPending) {
    return (
      <Card className="m-8">
        <CardContent><LoadingView /></CardContent>
      </Card>
    )
  }

  if (!vm.authenticated) {
    return vm.anonymous ? (
      <AuthView vm={vm} />
    ) : (
      <Card className="m-8">
        <CardContent><ErrorView error={vm.me.error!} retry={() => void vm.me.refetch()} /></CardContent>
      </Card>
    )
  }

  return (
    <SidebarProvider defaultOpen={false} data-testid="portal-view-container">
      <AuthenticatedPortalView vm={vm} />
    </SidebarProvider>
  )
}

function AuthenticatedPortalView({ vm }: { vm: PortalViewModel }) {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  const current = vm.snapshot.data ?? vm.items.find(workspace => workspace.id === vm.workspaceId)
  const section = sectionCopy(t)[vm.tab]
  const globalSection = vm.tab === 'mcp-key' || vm.tab === 'admin-mcp-keys' || vm.tab === 'admin-users' || vm.tab === 'admin-workspaces'
  const showWorkspaceSearch = isMobile && vm.workspaceId && vm.tab === 'collections'
  const sectionGroup = vm.tab === 'collections' || vm.tab === 'history'
    ? t('group.api')
    : vm.tab === 'design-ui' || vm.tab === 'design-database'
      ? t('group.design')
      : globalSection
        ? (vm.tab === 'admin-users' || vm.tab === 'admin-workspaces' ? t('group.admin') : t('group.account'))
      : null
  const selectedRequest = vm.tab === 'collections' ? vm.selected : null

  return (
    <>
      <PortalSidebar vm={vm} />
      <SidebarInset className="workspace-content min-w-0">
        <FieldGroup role="banner" className="flex-row items-center gap-3 border-b bg-card px-4 py-3">
          <PortalSidebarTrigger
            placement={isMobile ? 'mobile-toolbar' : 'desktop-header'}
            className={isMobile ? 'size-11 shrink-0' : 'size-8 shrink-0 rounded-md'}
          />
          <Separator orientation="vertical" className="h-5" />
          <Breadcrumb className="min-w-0 flex-1 overflow-hidden" data-testid="portal-breadcrumb">
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 max-w-40 justify-start truncate px-2 font-normal"
                    onClick={() => vm.openWorkspace('')}
                    data-testid="breadcrumb-workspaces-link"
                  >
                    {t('auth.brandName')}
                  </Button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:flex" />
              {!vm.workspaceId && !globalSection ? (
                <BreadcrumbItem><BreadcrumbPage>{t('shell.workspaces')}</BreadcrumbPage></BreadcrumbItem>
              ) : !vm.workspaceId ? (
                <>
                  <BreadcrumbItem><FieldDescription>{t('group.account')}</FieldDescription></BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem><BreadcrumbPage>{section.title}</BreadcrumbPage></BreadcrumbItem>
                </>
              ) : (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 max-w-40 justify-start truncate px-2 font-normal"
                        onClick={() => vm.setTab('overview')}
                        data-testid="breadcrumb-workspace-link"
                      >
                        {current?.name ?? t('shell.workspaceFallback')}
                      </Button>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  {sectionGroup && (
                    <>
                      <BreadcrumbItem className="hidden sm:inline-flex"><FieldDescription>{sectionGroup}</FieldDescription></BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden sm:flex" />
                    </>
                  )}
                  <BreadcrumbItem>
                    {selectedRequest ? (
                      <BreadcrumbLink asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 justify-start px-2 font-normal"
                          onClick={() => vm.setSelected(null)}
                          data-testid="breadcrumb-collections-link"
                        >
                          {section.title}
                        </Button>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{section.title}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {selectedRequest && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem><BreadcrumbPage>{selectedRequest.name}</BreadcrumbPage></BreadcrumbItem>
                    </>
                  )}
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </FieldGroup>

        <FieldGroup role="main" className="min-w-0 gap-6 bg-background p-4 md:p-7 xl:p-8">
          <FieldGroup className="gap-3">
            <FieldTitle role="heading" aria-level={1} className="text-2xl leading-tight tracking-tight">
              {vm.workspaceId || globalSection ? section.title : t('shell.workspaces')}
            </FieldTitle>
            <FieldDescription className="max-w-2xl text-base leading-relaxed">
              {vm.workspaceId || globalSection ? section.description : t('shell.openWorkspaceDescription')}
            </FieldDescription>
          </FieldGroup>

          <FieldGroup className="gap-6">
            {(showWorkspaceSearch || (!vm.workspaceId && !globalSection)) && (
              <FieldGroup className="flex-row flex-wrap items-end justify-between gap-3">
                {(showWorkspaceSearch || (isMobile && !vm.workspaceId)) && (
                  <Field className="max-w-sm">
                    <FieldLabel htmlFor="portal-search-input-mobile">
                      {vm.workspaceId ? t('shell.findRequest') : t('shell.findWorkspace')}
                    </FieldLabel>
                    <Input
                      id="portal-search-input-mobile"
                      placeholder={vm.workspaceId ? t('shell.searchRequestPlaceholder') : t('shell.searchWorkspacesPlaceholder')}
                      value={vm.search}
                      onChange={event => vm.setSearch(event.target.value)}
                      data-testid="portal-search-input"
                    />
                  </Field>
                )}
                {!vm.workspaceId && !globalSection && (
                  <Button
                    className="cursor-pointer"
                    onClick={() => vm.setCreateOpen(true)}
                    data-testid="workspace-create-button"
                  >
                    {t('shell.newWorkspace')}
                  </Button>
                )}
              </FieldGroup>
            )}

            {vm.workspaceId || globalSection ? (
              <WorkspaceView vm={vm} />
            ) : vm.workspaces.isPending ? (
              <LoadingView />
            ) : vm.workspaces.error ? (
              <ErrorView error={vm.workspaces.error} retry={() => void vm.workspaces.refetch()} />
            ) : !vm.items.length ? (
              <EmptyView
                title={t('empty.noWorkspacesTitle')}
                description={t('empty.noWorkspacesDescription')}
              />
            ) : (
              <WorkspaceDirectoryView vm={vm} />
            )}
          </FieldGroup>
        </FieldGroup>
      </SidebarInset>

      <Dialog open={vm.createOpen} onOpenChange={vm.setCreateOpen}>
        <DialogContent data-testid="workspace-create-dialog">
          <DialogHeader>
            <DialogTitle>{t('dialog.createTitle')}</DialogTitle>
            <DialogDescription>{t('dialog.createDescription')}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="workspace-name">{t('dialog.nameLabel')}</FieldLabel>
            <Input
              id="workspace-name"
              value={vm.name}
              maxLength={120}
              onChange={event => vm.setName(event.target.value)}
              data-testid="workspace-name-input"
            />
          </Field>
          {vm.create.error && <ErrorView error={vm.create.error} />}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => vm.setCreateOpen(false)}
              data-testid="workspace-cancel-button"
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!vm.name.trim() || vm.create.isPending}
              onClick={() => vm.create.mutate()}
              data-testid="workspace-save-button"
            >
              {vm.create.isPending ? t('common.creating') : t('dialog.createAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
