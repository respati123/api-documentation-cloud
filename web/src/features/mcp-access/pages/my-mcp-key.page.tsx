import { useMyMcpKeyViewModel } from '@/features/mcp-access/viewmodels/use-my-mcp-key.viewmodel'
import { MyMcpKeyView } from '@/features/mcp-access/views/my-mcp-key.view'

export function MyMcpKeyPage() {
  const vm = useMyMcpKeyViewModel()
  return <MyMcpKeyView {...vm} />
}
