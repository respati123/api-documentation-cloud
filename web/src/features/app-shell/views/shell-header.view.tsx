import { Building2, Check, ChevronsUpDown, KeyRound, Layers, LayoutList, LogOut, Menu, Plus, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SHELL_TEXT } from '@/features/app-shell/constants/app-shell-text.constants'
import type { AppRoute } from '@/features/app-shell/models/route.model'
import { readRoute } from '@/features/app-shell/utils/route'
import { NotificationsMenu } from '@/features/notifications'
import { LanguageMenu } from '@/shared/components/language-menu'
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
import type { CloudUser } from '@/shared/models/user.model'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'

export interface ShellHeaderViewProps {
  user: CloudUser
  workspaces: CloudWorkspaceRef[]
  currentWorkspace: CloudWorkspaceRef | null
  hasMoreWorkspaces: boolean
  isLoadingMoreWorkspaces: boolean
  onLoadMoreWorkspaces: () => void
  onNavigate: (route: AppRoute) => void
  onCreateWorkspace: () => void
  onOpenMobileNav: () => void
  onSignOut: () => void
}

export function ShellHeaderView({
  user,
  workspaces,
  currentWorkspace,
  hasMoreWorkspaces,
  isLoadingMoreWorkspaces,
  onLoadMoreWorkspaces,
  onNavigate,
  onCreateWorkspace,
  onOpenMobileNav,
  onSignOut,
}: ShellHeaderViewProps) {
  const { t } = useTranslation('shell')
  const accountName = user.email.split('@')[0]
  const initials = accountName
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <header
      data-testid="cloud-shell-header"
      className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-5"
    >
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={t(SHELL_TEXT.nav.menu)}
        data-testid="cloud-mobile-menu-button"
        onClick={onOpenMobileNav}
      >
        <Menu />
      </Button>
      <Button
        variant="ghost"
        className="h-9 gap-2 px-1.5"
        aria-label={t(SHELL_TEXT.brand.name)}
        data-testid="cloud-brand-button"
        onClick={() => onNavigate({ page: 'overview' })}
      >
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-md border border-primary bg-primary/20">
          <Layers className="size-4" />
        </span>
        <span className="hidden text-sm font-semibold lg:inline">{t(SHELL_TEXT.brand.name)}</span>
      </Button>
      <span aria-hidden="true" className="hidden text-muted-foreground/60 sm:inline">
        /
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="h-9 min-w-0 max-w-[14rem] justify-start gap-2 px-2 sm:max-w-xs"
              aria-label={t(SHELL_TEXT.switcher.label)}
              data-testid="cloud-workspace-switcher-button"
            />
          }
        >
          <span className="truncate text-sm font-medium" data-testid="cloud-workspace-switcher-current">
            {currentWorkspace ? currentWorkspace.name : t(SHELL_TEXT.switcher.placeholder)}
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t(SHELL_TEXT.switcher.yourWorkspaces)}</DropdownMenuLabel>
            {workspaces.length === 0 && (
              <p className="px-2 py-2 text-sm text-muted-foreground" data-testid="cloud-workspace-switcher-empty">
                {t(SHELL_TEXT.switcher.empty)}
              </p>
            )}
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                data-testid={`cloud-workspace-switcher-item-${workspace.id}`}
                onClick={() => onNavigate({ page: 'workspace', workspaceId: workspace.id, tab: 'overview' })}
              >
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                {currentWorkspace?.id === workspace.id && <Check aria-hidden="true" className="text-primary" />}
              </DropdownMenuItem>
            ))}
            {hasMoreWorkspaces && (
              <DropdownMenuItem
                closeOnClick={false}
                disabled={isLoadingMoreWorkspaces}
                data-testid="cloud-workspace-switcher-load-more"
                onClick={onLoadMoreWorkspaces}
              >
                {t(SHELL_TEXT.switcher.loadMore)}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem data-testid="cloud-workspace-switcher-all" onClick={() => onNavigate({ page: 'workspaces' })}>
            <LayoutList />
            {t(SHELL_TEXT.switcher.allWorkspaces)}
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="cloud-workspace-switcher-create" onClick={onCreateWorkspace}>
            <Plus />
            {t(SHELL_TEXT.switcher.createWorkspace)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="ml-auto flex items-center gap-1">
        <NotificationsMenu onOpenLink={(link) => onNavigate(readRoute(link))} />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label={t(SHELL_TEXT.account.settings)} data-testid="cloud-account-menu-button" />
            }
          >
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
            >
              {initials || 'A'}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-64">
            <div className="grid px-2 py-1.5">
              <span className="truncate text-sm font-medium">{accountName}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
            <DropdownMenuSeparator />
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
      </div>
    </header>
  )
}
