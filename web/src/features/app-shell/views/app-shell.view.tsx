import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SHELL_TEXT } from '@/features/app-shell/constants/app-shell-text.constants'
import type { AppRoute } from '@/features/app-shell/models/route.model'
import type { SidebarItem } from '@/features/app-shell/models/sidebar.model'
import { ShellHeaderView } from '@/features/app-shell/views/shell-header.view'
import { ShellSidebarView } from '@/features/app-shell/views/shell-sidebar.view'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/components/primitives/sheet'
import type { CloudUser } from '@/shared/models/user.model'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'

export interface AppShellViewProps {
  route: AppRoute
  user: CloudUser
  workspaces: CloudWorkspaceRef[]
  currentWorkspace: CloudWorkspaceRef | null
  sidebarItems: SidebarItem[]
  expandedGroups: Record<string, boolean>
  onGroupExpandedChange: (group: string, expanded: boolean) => void
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
  currentWorkspace,
  sidebarItems,
  expandedGroups,
  onGroupExpandedChange,
  mobileNavOpen,
  onMobileNavOpenChange,
  onNavigate,
  hasMoreWorkspaces,
  isLoadingMoreWorkspaces,
  onLoadMoreWorkspaces,
  onCreateWorkspace,
  onSignOut,
  children,
}: AppShellViewProps) {
  const { t } = useTranslation('shell')
  const sidebar = (
    <ShellSidebarView
      items={sidebarItems}
      inWorkspace={route.page === 'workspace'}
      expandedGroups={expandedGroups}
      onGroupExpandedChange={onGroupExpandedChange}
      onNavigate={(next) => {
        onMobileNavOpenChange(false)
        onNavigate(next)
      }}
    />
  )

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <ShellHeaderView
        user={user}
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        hasMoreWorkspaces={hasMoreWorkspaces}
        isLoadingMoreWorkspaces={isLoadingMoreWorkspaces}
        onLoadMoreWorkspaces={onLoadMoreWorkspaces}
        onNavigate={onNavigate}
        onCreateWorkspace={onCreateWorkspace}
        onOpenMobileNav={() => onMobileNavOpenChange(true)}
        onSignOut={onSignOut}
      />
      <div className="flex min-w-0 flex-1">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
          {sidebar}
        </aside>
        <Sheet open={mobileNavOpen} onOpenChange={onMobileNavOpenChange}>
          <SheetContent side="left" className="w-72 p-0 pt-10" data-testid="cloud-mobile-nav">
            <SheetHeader className="sr-only">
              <SheetTitle>{t(SHELL_TEXT.nav.menu)}</SheetTitle>
              <SheetDescription>{t(SHELL_TEXT.nav.mainLabel)}</SheetDescription>
            </SheetHeader>
            {sidebar}
          </SheetContent>
        </Sheet>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  )
}
