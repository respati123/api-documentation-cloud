import type { McpKeyStatus } from '@/features/mcp-access/models/mcp-key.model'
import { Badge } from '@/shared/components/primitives/badge'

const variants: Record<McpKeyStatus, 'success' | 'destructive' | 'ghost'> = {
  active: 'success',
  expired: 'destructive',
  revoked: 'ghost',
}

export function KeyStateBadge({ state, label }: { state: McpKeyStatus; label: string }) {
  return (
    <Badge variant={variants[state]} data-state={state}>
      {label}
    </Badge>
  )
}
