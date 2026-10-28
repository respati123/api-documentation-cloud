import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { WORKSPACE_TAB_TEXT, type WorkspaceTab } from '@/features/app-shell'
import { WORKSPACES_ROLE_TEXT } from '@/features/workspaces'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'
import { WORKSPACE_TEXT } from '../constants/workspace-detail-text.constants'

export interface WorkspacePageViewProps {
  workspace: CloudWorkspaceRef
  activeTab: WorkspaceTab
  tabs: readonly WorkspaceTab[]
  memberCount: number
  onTabChange: (tab: WorkspaceTab) => void
  onInvite: () => void
  children: ReactNode
}

export function WorkspacePageView({ workspace, activeTab, tabs, memberCount, onTabChange, onInvite, children }: WorkspacePageViewProps) {
  const { t } = useTranslation('workspace')
  return (
    <div data-testid="workspace-page" className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
            <Badge variant="secondary" data-testid="workspace-role-badge">
              {t(WORKSPACES_ROLE_TEXT[workspace.role])}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t(WORKSPACE_TEXT.header.subtitle)}</p>
        </div>
        {activeTab === 'team' && workspace.role === 'owner' && (
          <Button data-testid="workspace-invite-button" onClick={onInvite}>
            <Plus data-icon="inline-start" />
            {t(WORKSPACE_TEXT.header.invite)}
          </Button>
        )}
      </header>
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as WorkspaceTab)}>
        <TabsList aria-label={t(WORKSPACE_TEXT.tabs.label)} className="h-auto flex-wrap" data-testid="workspace-tabs">
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab} data-testid={`workspace-tab-${tab}`}>
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
