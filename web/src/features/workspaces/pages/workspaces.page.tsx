import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
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
          <h1 className="text-2xl font-semibold">{t(`${variant}.title`)}</h1>
          <p className="text-sm text-muted-foreground">{t(`${variant}.subtitle`)}</p>
        </div>
        <Button data-testid="workspaces-new-button" onClick={openCreate}>
          {t('list.create')}
        </Button>
      </header>
      {variant === 'overview' && vm.status === 'ready' && (
        <dl data-testid="workspaces-summary" className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border border-border p-3">
            <dt className="text-muted-foreground">{t('summary.total')}</dt>
            <dd className="text-xl font-semibold">{vm.workspaces.length}</dd>
          </div>
          <div className="rounded-md border border-border p-3">
            <dt className="text-muted-foreground">{t('summary.owned')}</dt>
            <dd className="text-xl font-semibold">{vm.ownedCount}</dd>
          </div>
          <div className="rounded-md border border-border p-3">
            <dt className="text-muted-foreground">{t('summary.shared')}</dt>
            <dd className="text-xl font-semibold">{vm.workspaces.length - vm.ownedCount}</dd>
          </div>
        </dl>
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
