import type { McpMemberKeyState } from '@/features/mcp-access/models/mcp-key.model'
import { Badge } from '@/shared/components/primitives/badge'

const variants: Record<McpMemberKeyState, 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost'> = {
  active: 'default',
  pending: 'secondary',
  missing: 'outline',
  claim_expired: 'destructive',
  expired: 'destructive',
  revoked: 'ghost',
}

export function KeyStateBadge({ state, label }: { state: McpMemberKeyState; label: string }) {
  return (
    <Badge variant={variants[state]} data-state={state}>
      {label}
    </Badge>
  )
}
