import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { WORKSPACES_PAGE_TEXT, WORKSPACES_TEXT } from '../constants/workspaces-text.constants'
import { useCreateWorkspaceStore } from '../stores/create-workspace.store'
import { useWorkspacesPageViewModel } from '../viewmodels/use-workspaces-page.viewmodel'
import { WorkspaceListView } from '../views/workspace-list.view'

export interface WorkspacesPageProps {
  variant: 'overview' | 'list'
  onOpenWorkspace: (workspaceId: string) => void
}

export function WorkspacesPage({ variant, onOpenWorkspace }: WorkspacesPageProps) {
  const { t } = useTranslation('workspaces')
  const vm = useWorkspacesPageViewModel()
  const openCreate = useCreateWorkspaceStore((state) => state.open)

  return (
    <div data-testid={`workspaces-${variant}-page`} className="mx-auto grid max-w-4xl gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">{t(WORKSPACES_PAGE_TEXT[variant].title)}</h1>
          <p className="text-sm text-muted-foreground">{t(WORKSPACES_PAGE_TEXT[variant].subtitle)}</p>
        </div>
        <Button data-testid="workspaces-new-button" onClick={openCreate}>
          {t(WORKSPACES_TEXT.list.create)}
        </Button>
      </header>
      {variant === 'overview' && vm.status === 'ready' && (
        <div data-testid="workspaces-summary" className="grid grid-cols-3 gap-3 text-sm">
          <Card size="sm">
            <CardContent>
              <p className="text-muted-foreground">{t(WORKSPACES_TEXT.summary.total)}</p>
              <p className="text-xl font-semibold">{vm.workspaces.length}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p className="text-muted-foreground">{t(WORKSPACES_TEXT.summary.owned)}</p>
              <p className="text-xl font-semibold">{vm.ownedCount}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p className="text-muted-foreground">{t(WORKSPACES_TEXT.summary.shared)}</p>
              <p className="text-xl font-semibold">{vm.workspaces.length - vm.ownedCount}</p>
            </CardContent>
          </Card>
        </div>
      )}
      <WorkspaceListView
        status={vm.status}
        workspaces={vm.workspaces}
        errorMessage={vm.errorMessage}
        onOpen={onOpenWorkspace}
        onCreate={openCreate}
        onRetry={vm.retry}
      />
    </div>
  )
}
