import { useAdminUsersViewModel } from '@/features/admin-users/viewmodels/use-admin-users.viewmodel'
import { AdminUsersView } from '@/features/admin-users/views/admin-users.view'

export function AdminUsersPage() {
  const vm = useAdminUsersViewModel()
  return <AdminUsersView {...vm} />
}
