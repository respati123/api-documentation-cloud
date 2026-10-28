import { Layers, LayoutGrid, LogOut, Menu, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SplitFlap } from '@/shared/components/split-flap'
import { Badge } from '@/shared/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/components/ui/breadcrumb'
import { Button } from '@/shared/components/ui/button'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Separator } from '@/shared/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'
import { appVersion } from '@/shared/config/app-version'
import type { CloudUser } from '@/shared/models/user.model'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'
import { SHELL_PAGE_TITLE, SHELL_TEXT, WORKSPACE_TAB_TEXT } from '../constants/app-shell-text.constants'
import type { AppRoute, WorkspaceTab } from '../models/route.model'

export interface AppShellViewProps {
  route: AppRoute
  user: CloudUser
  workspaces: CloudWorkspaceRef[]
  apiOnline: boolean | null
  mobileNavOpen: boolean
  onMobileNavOpenChange: (open: boolean) => void
  onNavigate: (route: AppRoute, replace?: boolean) => void
  onCreateWorkspace: () => void
  onSignOut: () => void
  children: ReactNode
}

export function AppShellView({
  route,
  user,
  workspaces,
  apiOnline,
  mobileNavOpen,
  onMobileNavOpenChange,
  onNavigate,
  onCreateWorkspace,
  onSignOut,
  children,
}: AppShellViewProps) {
  const { t } = useTranslation('shell')
  const selectedWorkspace = route.page === 'workspace' ? workspaces.find((workspace) => workspace.id === route.workspaceId) : undefined
  const apiLabel = apiOnline === null ? t(SHELL_TEXT.api.checking) : apiOnline ? t(SHELL_TEXT.api.connected) : t(SHELL_TEXT.api.unavailable)
  const pageTitle = route.page === 'workspace' ? (selectedWorkspace?.name ?? t(SHELL_TEXT.page.workspace)) : t(SHELL_PAGE_TITLE[route.page])
  const navigation = (
    <ShellNavigation
      route={route}
      user={user}
      workspaces={workspaces}
      selectedWorkspaceId={selectedWorkspace?.id}
      onNavigate={(next) => {
        onMobileNavOpenChange(false)
        onNavigate(next)
      }}
      onCreateWorkspace={onCreateWorkspace}
      onSignOut={onSignOut}
    />
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">{navigation}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:px-6">
          <Sheet open={mobileNavOpen} onOpenChange={onMobileNavOpenChange}>
            <SheetTrigger render={<Button variant="ghost" size="sm" className="md:hidden" data-testid="cloud-mobile-menu-button" />}>
              <Menu data-icon="inline-start" />
              {t(SHELL_TEXT.nav.menu)}
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>{t(SHELL_TEXT.nav.menu)}</SheetTitle>
                <SheetDescription>{t(SHELL_TEXT.nav.mainLabel)}</SheetDescription>
              </SheetHeader>
              {navigation}
            </SheetContent>
          </Sheet>
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-nowrap overflow-hidden">
              <BreadcrumbItem>
                <BreadcrumbLink
                  render={
                    <Button variant="link" className="h-auto p-0 text-muted-foreground" onClick={() => onNavigate({ page: 'overview' })} />
                  }
                >
                  {t(SHELL_TEXT.breadcrumb.root)}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                {route.page === 'workspace' && route.tab && route.tab !== 'overview' ? (
                  <BreadcrumbLink
                    className="truncate"
                    render={
                      <Button
                        variant="link"
                        className="h-auto p-0 text-muted-foreground"
                        onClick={() => onNavigate({ page: 'workspace', workspaceId: route.workspaceId, tab: 'overview' })}
                      />
                    }
                  >
                    {pageTitle}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate whitespace-nowrap">{pageTitle}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {route.page === 'workspace' && route.tab && route.tab !== 'overview' && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="whitespace-nowrap">{t(WORKSPACE_TAB_TEXT[route.tab as WorkspaceTab])}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
          <Badge
            variant="outline"
            role="status"
            className="shrink-0 gap-2"
            data-testid="cloud-api-status"
            data-state={apiOnline === false ? 'offline' : 'online'}
          >
            <span
              aria-hidden="true"
              className={apiOnline === false ? 'size-2 rounded-full bg-destructive' : 'size-2 rounded-full bg-success'}
            />
            <SplitFlap value={apiLabel} className="text-xs max-sm:sr-only" />
          </Badge>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

function ShellNavigation({
  route,
  user,
  workspaces,
  selectedWorkspaceId,
  onNavigate,
  onCreateWorkspace,
  onSignOut,
}: {
  route: AppRoute
  user: CloudUser
  workspaces: CloudWorkspaceRef[]
  selectedWorkspaceId: string | undefined
  onNavigate: (route: AppRoute) => void
  onCreateWorkspace: () => void
  onSignOut: () => void
}) {
  const { t } = useTranslation('shell')
  const accountName = user.email.split('@')[0]
  const initials = accountName
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <nav aria-label={t(SHELL_TEXT.nav.mainLabel)} className="flex min-h-0 flex-1 flex-col gap-4 p-3">
      <Button
        variant="ghost"
        className="h-auto justify-start gap-3 px-2 py-2"
        data-testid="cloud-brand-button"
        onClick={() => onNavigate({ page: 'overview' })}
      >
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-md border border-primary bg-primary/20">
          <Layers className="size-4" />
        </span>
        <span className="grid text-left">
          <span className="text-sm font-semibold">{t(SHELL_TEXT.brand.name)}</span>
          <span className="text-xs text-muted-foreground">{t(SHELL_TEXT.brand.subtitle)}</span>
        </span>
      </Button>
      <div className="grid gap-1">
        <p className="px-2 text-xs text-muted-foreground">{t(SHELL_TEXT.nav.groupWorkspace)}</p>
        <Button
          variant="ghost"
          className="justify-start"
          aria-current={route.page === 'overview' ? 'page' : undefined}
          data-testid="cloud-nav-overview"
          onClick={() => onNavigate({ page: 'overview' })}
        >
          <LayoutGrid data-icon="inline-start" />
          {t(SHELL_TEXT.nav.overview)}
        </Button>
        <Button
          variant="ghost"
          className="justify-start"
          aria-current={route.page === 'workspaces' ? 'page' : undefined}
          data-testid="cloud-nav-workspaces"
          onClick={() => onNavigate({ page: 'workspaces' })}
        >
          <Layers data-icon="inline-start" />
          {t(SHELL_TEXT.nav.workspaces)}
          <Badge variant="secondary" className="ml-auto">
            {workspaces.length}
          </Badge>
        </Button>
      </div>
      <Separator />
      <div className="flex items-center justify-between gap-2 px-2">
        <p className="text-xs text-muted-foreground">{t(SHELL_TEXT.nav.yourWorkspaces)}</p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t(SHELL_TEXT.nav.createWorkspace)}
          data-testid="cloud-create-workspace-button"
          onClick={onCreateWorkspace}
        >
          <Plus />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-1 pr-2">
          {workspaces.length ? (
            workspaces.map((workspace) => (
              <Button
                key={workspace.id}
                variant="ghost"
                className="h-auto justify-start gap-2 py-2"
                title={workspace.name}
                aria-current={selectedWorkspaceId === workspace.id ? 'page' : undefined}
                onClick={() => onNavigate({ page: 'workspace', workspaceId: workspace.id, tab: 'overview' })}
              >
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-md bg-secondary text-xs font-semibold">
                  {workspace.name.trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">{workspace.name}</span>
              </Button>
            ))
          ) : (
            <p className="px-2 text-xs text-muted-foreground">{t(SHELL_TEXT.nav.emptyWorkspaces)}</p>
          )}
        </div>
      </ScrollArea>
      <Separator />
      <div className="grid gap-3 px-2">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
            {initials || 'A'}
          </span>
          <span className="grid min-w-0">
            <span className="truncate text-sm font-medium">{accountName}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
        </div>
        <Button variant="outline" size="sm" data-testid="cloud-sign-out-button" onClick={onSignOut}>
          <LogOut data-icon="inline-start" />
          {t(SHELL_TEXT.account.signOut)}
        </Button>
        <p data-testid="cloud-app-version" className="text-xs text-muted-foreground">
          {t(SHELL_TEXT.nav.version, { version: appVersion })}
        </p>
      </div>
    </nav>
  )
}
