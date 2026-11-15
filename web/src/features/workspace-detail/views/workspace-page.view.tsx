import { BookOpen, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { WORKSPACE_TAB_TEXT, type WorkspaceTab } from '@/features/app-shell'
import { WORKSPACES_ROLE_TEXT } from '@/features/workspaces'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/primitives/tabs'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'
import { WORKSPACE_TEXT } from '../constants/workspace-detail-text.constants'
import type { LiveStatus } from '../viewmodels/use-workspace-live-sync.viewmodel'

export interface WorkspacePageViewProps {
  workspace: CloudWorkspaceRef
  adminView: boolean
  activeTab: WorkspaceTab
  tabs: readonly WorkspaceTab[]
  memberCount: number
  liveStatus: LiveStatus
  onTabChange: (tab: WorkspaceTab) => void
  onInvite: () => void
  children: ReactNode
}

export function WorkspacePageView({
  workspace,
  adminView,
  activeTab,
  tabs,
  memberCount,
  onTabChange,
  onInvite,
  children,
}: WorkspacePageViewProps) {
  const { t } = useTranslation('workspace')
  return (
    <div data-testid="workspace-page" className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate font-heading text-2xl font-semibold tracking-tight">{workspace.name}</h1>
            <Badge variant="secondary" data-testid="workspace-role-badge">
              {adminView ? t(WORKSPACE_TEXT.header.adminView) : t(WORKSPACES_ROLE_TEXT[workspace.role])}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t(WORKSPACE_TEXT.header.subtitle)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'team' && workspace.role === 'owner' && (
            <Button variant="outline" data-testid="workspace-invite-button" onClick={onInvite}>
              <Plus data-icon="inline-start" />
              {t(WORKSPACE_TEXT.header.invite)}
            </Button>
          )}
          {activeTab !== 'docs' && (
            <Button data-testid="workspace-open-docs-button" onClick={() => onTabChange('docs')}>
              <BookOpen data-icon="inline-start" />
              {t(WORKSPACE_TEXT.overview.browseDocs)}
            </Button>
          )}
        </div>
      </header>
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as WorkspaceTab)}>
        <TabsList
          variant="line"
          aria-label={t(WORKSPACE_TEXT.tabs.label)}
          className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border p-0"
          data-testid="workspace-tabs"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              data-testid={`workspace-tab-${tab}`}
              className="h-10 flex-none rounded-none border-0 border-b-2 border-transparent px-3 text-muted-foreground data-active:border-primary data-active:bg-transparent data-active:text-foreground"
            >
              {t(WORKSPACE_TAB_TEXT[tab])}
              {tab === 'team' && <Badge variant="outline">{memberCount}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {children}
    </div>
  )
}
