import { useAdminWorkspacesViewModel } from '@/features/admin-workspaces/viewmodels/use-admin-workspaces.viewmodel'
import { AdminWorkspacesView } from '@/features/admin-workspaces/views/admin-workspaces.view'

export function AdminWorkspacesPage() {
  const vm = useAdminWorkspacesViewModel()
  return <AdminWorkspacesView {...vm} />
}
