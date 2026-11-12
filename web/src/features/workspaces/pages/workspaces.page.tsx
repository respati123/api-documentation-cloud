import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/primitives/button'
import { Card, CardContent } from '@/shared/components/primitives/card'
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
  const summaryItems = [
    { label: t(WORKSPACES_TEXT.summary.total), hint: t(WORKSPACES_TEXT.summary.totalHint), value: vm.total },
    { label: t(WORKSPACES_TEXT.summary.owned), hint: t(WORKSPACES_TEXT.summary.ownedHint), value: vm.ownedCount },
    { label: t(WORKSPACES_TEXT.summary.shared), hint: t(WORKSPACES_TEXT.summary.sharedHint), value: vm.sharedCount },
  ]

  return (
    <div data-testid={`workspaces-${variant}-page`} className="grid gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t(WORKSPACES_PAGE_TEXT[variant].title)}</h1>
          <p className="text-sm text-muted-foreground">{t(WORKSPACES_PAGE_TEXT[variant].subtitle)}</p>
        </div>
        <Button data-testid="workspaces-new-button" onClick={openCreate}>
          <Plus className="size-4" />
          {t(WORKSPACES_TEXT.list.create)}
        </Button>
      </header>
      {variant === 'overview' && vm.status === 'ready' && (
        <div data-testid="workspaces-summary" className="grid gap-4 sm:grid-cols-3">
          {summaryItems.map((item) => (
            <Card key={item.label} size="sm">
              <CardContent className="grid gap-1 p-5">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-3xl font-semibold tabular-nums">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <WorkspaceListView
        status={vm.status}
        workspaces={vm.workspaces}
        errorMessage={vm.errorMessage}
        hasMore={vm.hasMore}
        isLoadingMore={vm.isLoadingMore}
        onLoadMore={vm.loadMore}
        onOpen={onOpenWorkspace}
        onCreate={openCreate}
        onRetry={vm.retry}
      />
    </div>
  )
}

import { Plus } from 'lucide-react'
