import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { WORKSPACE_TAB_TEXT, type WorkspaceTab } from '@/features/app-shell'
import { WORKSPACE_SECTION_DETAIL_TEXT, WORKSPACE_TEXT } from '@/features/workspace-detail/constants/workspace-detail-text.constants'
import type { LiveStatus } from '@/features/workspace-detail/viewmodels/use-workspace-live-sync.viewmodel'
import { WORKSPACES_ROLE_TEXT } from '@/features/workspaces'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'

export interface WorkspacePageViewProps {
  workspace: CloudWorkspaceRef
  adminView: boolean
  activeTab: WorkspaceTab
  canInvite: boolean
  liveStatus: LiveStatus
  onInvite: () => void
  children: ReactNode
}

// The sidebar is the workspace navigation, so the page header only names the open section.
export function WorkspacePageView({ workspace, adminView, activeTab, canInvite, onInvite, children }: WorkspacePageViewProps) {
  const { t } = useTranslation('workspace')
  return (
    <div data-testid="workspace-page" data-section={activeTab} className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="truncate" data-testid="workspace-name">
              {workspace.name}
            </span>
            <Badge variant="secondary" data-testid="workspace-role-badge">
              {adminView ? t(WORKSPACE_TEXT.header.adminView) : t(WORKSPACES_ROLE_TEXT[workspace.role])}
            </Badge>
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight" data-testid="workspace-section-title">
            {t(WORKSPACE_TAB_TEXT[activeTab])}
          </h1>
          <p className="text-sm text-muted-foreground">{t(WORKSPACE_SECTION_DETAIL_TEXT[activeTab])}</p>
        </div>
        {canInvite && (
          <Button variant="outline" data-testid="workspace-invite-button" onClick={onInvite}>
            <Plus data-icon="inline-start" />
            {t(WORKSPACE_TEXT.header.invite)}
          </Button>
        )}
      </header>
      {children}
    </div>
  )
}
