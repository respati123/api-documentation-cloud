import { useAdminWorkspacesViewModel } from '@/features/admin-workspaces/viewmodels/use-admin-workspaces.viewmodel'
import { AdminWorkspacesView } from '@/features/admin-workspaces/views/admin-workspaces.view'

export function AdminWorkspacesPage({ onOpenWorkspace }: { onOpenWorkspace: (workspaceId: string) => void }) {
  const vm = useAdminWorkspacesViewModel()
  return <AdminWorkspacesView {...vm} onOpenWorkspace={onOpenWorkspace} />
}
