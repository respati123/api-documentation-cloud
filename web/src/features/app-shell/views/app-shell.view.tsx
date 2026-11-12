import { Building2, KeyRound, Layers, LayoutGrid, LogOut, Menu, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NotificationsMenu } from '@/features/notifications'
import { LanguageMenu } from '@/shared/components/language-menu'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/primitives/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/primitives/sheet'
import { appVersion } from '@/shared/config/app-version'
import type { CloudUser } from '@/shared/models/user.model'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'
import { SHELL_TEXT } from '../constants/app-shell-text.constants'
import type { AppRoute } from '../models/route.model'
import { readRoute } from '../utils/route'

export interface AppShellViewProps {
  route: AppRoute
  user: CloudUser
  workspaces: CloudWorkspaceRef[]
  apiOnline: boolean | null
  mobileNavOpen: boolean
  onMobileNavOpenChange: (open: boolean) => void
  onNavigate: (route: AppRoute, replace?: boolean) => void
  hasMoreWorkspaces: boolean
  isLoadingMoreWorkspaces: boolean
  onLoadMoreWorkspaces: () => void
  onCreateWorkspace: () => void
  onSignOut: () => void
  children: ReactNode
}

export function AppShellView({
  route,
  user,
  workspaces,
  mobileNavOpen,
  onMobileNavOpenChange,
  onNavigate,
  onSignOut,
  children,
}: AppShellViewProps) {
  const { t } = useTranslation('shell')
  const navigation = (
    <ShellNavigation
      route={route}
      user={user}
      workspaces={workspaces}
      onNavigate={(next) => {
        onMobileNavOpenChange(false)
        onNavigate(next)
      }}
      onSignOut={onSignOut}
    />
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">{navigation}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-4 pt-4 md:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={onMobileNavOpenChange}>
            <SheetTrigger render={<Button variant="outline" size="sm" data-testid="cloud-mobile-menu-button" />}>
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
        </div>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  )
}

function ShellNavigation({
  route,
  user,
  workspaces,
  onNavigate,
  onSignOut,
}: {
  route: AppRoute
  user: CloudUser
  workspaces: CloudWorkspaceRef[]
  onNavigate: (route: AppRoute) => void
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
          className={route.page === 'overview' ? 'justify-start bg-primary/10 text-primary' : 'justify-start'}
          aria-current={route.page === 'overview' ? 'page' : undefined}
          data-testid="cloud-nav-overview"
          onClick={() => onNavigate({ page: 'overview' })}
        >
          <LayoutGrid data-icon="inline-start" />
          {t(SHELL_TEXT.nav.overview)}
        </Button>
        <Button
          variant="ghost"
          className={route.page === 'workspaces' ? 'justify-start bg-primary/10 text-primary' : 'justify-start'}
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
      <div className="mt-auto grid gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="h-auto min-w-0 flex-1 justify-start gap-3 px-2 py-2"
                  data-testid="cloud-account-menu-button"
                />
              }
            >
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
              >
                {initials || 'A'}
              </span>
              <span className="grid min-w-0 text-left">
                <span className="truncate text-sm font-medium">{accountName}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t(SHELL_TEXT.account.settings)}</DropdownMenuLabel>
                <LanguageMenu />
                <DropdownMenuItem data-testid="cloud-mcp-settings" onClick={() => onNavigate({ page: 'mcp' })}>
                  <KeyRound />
                  {t(SHELL_TEXT.account.mcp)}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {user.isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t(SHELL_TEXT.account.admin)}</DropdownMenuLabel>
                    <DropdownMenuItem data-testid="cloud-admin-mcp" onClick={() => onNavigate({ page: 'admin-mcp' })}>
                      <ShieldCheck />
                      {t(SHELL_TEXT.account.adminMcp)}
                    </DropdownMenuItem>
                    <DropdownMenuItem data-testid="cloud-admin-workspaces" onClick={() => onNavigate({ page: 'admin-workspaces' })}>
                      <Building2 />
                      {t(SHELL_TEXT.account.adminWorkspaces)}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid="cloud-sign-out-button" onClick={onSignOut}>
                <LogOut />
                {t(SHELL_TEXT.account.signOut)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <NotificationsMenu onOpenLink={(link) => onNavigate(readRoute(link))} />
        </div>
        <p data-testid="cloud-app-version" className="px-2 text-xs text-muted-foreground">
          {t(SHELL_TEXT.nav.version, { version: appVersion })}
        </p>
      </div>
    </nav>
  )
}
