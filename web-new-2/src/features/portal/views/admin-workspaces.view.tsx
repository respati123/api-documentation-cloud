import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/data-table/data-table'
import { FieldDescription, FieldTitle } from '@/components/ui/field'
import type { AdminWorkspacesViewModel } from '../hooks/use-admin-workspaces.viewmodel'
import type { AdminWorkspace } from '../models/portal.model'
import { EmptyView, ErrorView } from './state.view'

export function AdminWorkspacesView({ vm }: { vm: AdminWorkspacesViewModel }) {
  const { t } = useTranslation()
  return (
    <DataTable<AdminWorkspace>
      testId="admin-workspaces-table"
      title={t('admin.workspacesTitle')}
      description={t('admin.workspacesDescription')}
      rows={vm.items}
      getRowId={workspace => workspace.id}
      getRowTestId={workspace => `admin-workspace-${workspace.id}`}
      search={{ value: vm.search, onChange: vm.setSearch, label: t('admin.workspaceSearchLabel'), placeholder: t('admin.workspaceSearchPlaceholder') }}
      state={vm.status === 'loading' ? 'loading' : vm.status === 'error' ? 'error' : vm.status === 'empty' ? 'empty' : 'ready'}
      errorNode={vm.error && <ErrorView error={vm.error} retry={vm.retry} testId="admin-workspaces-load-error" />}
      emptyNode={<EmptyView title={t('admin.noWorkspaces')} description={t('admin.noWorkspacesDescription')} testId="admin-workspaces-empty" />}
      hasMore={vm.hasNextPage}
      loadingMore={vm.isFetchingNextPage}
      onLoadMore={vm.loadMore}
      columns={[
        { id: 'name', header: t('admin.wsColName'), cell: workspace => <FieldTitle className="text-sm font-medium break-words">{workspace.name}</FieldTitle>, className: 'max-w-64' },
        { id: 'owner', header: t('admin.wsColOwner'), cell: workspace => <FieldDescription className="text-foreground break-all">{workspace.ownerEmail}</FieldDescription> },
        { id: 'members', header: t('admin.wsColMembers'), cell: workspace => workspace.memberCount },
        { id: 'created', header: t('admin.wsColCreated'), cell: workspace => new Date(workspace.createdAt).toLocaleDateString() },
      ]}
      rowActions={() => [{ id: 'open', label: t('admin.openWorkspace'), onSelect: workspace => vm.open(workspace.id) }]}
    />
  )
}
