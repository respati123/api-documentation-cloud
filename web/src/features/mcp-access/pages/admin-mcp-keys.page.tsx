import { useAdminMcpKeysViewModel } from '@/features/mcp-access/viewmodels/use-admin-mcp-keys.viewmodel'
import { AdminMcpKeysView } from '@/features/mcp-access/views/admin-mcp-keys.view'

export function AdminMcpKeysPage() {
  const vm = useAdminMcpKeysViewModel()
  return <AdminMcpKeysView {...vm} />
}
