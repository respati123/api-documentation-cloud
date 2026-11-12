import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { MCP_ACCESS_TEXT } from '@/features/mcp-access/constants/mcp-access-text.constants'
import { mcpKeysService } from '@/features/mcp-access/services/mcp-keys.service'
import { setupSnippets } from '@/features/mcp-access/utils/setup-snippets'
import { absoluteApiUrl } from '@/shared/services/api-client'
import { readErrorMessage } from '@/shared/utils/error-message'

export const mcpKeyQueryKeys = {
  all: ['mcp-key'] as const,
  mine: ['mcp-key', 'mine'] as const,
  guide: ['mcp-key', 'guide'] as const,
  members: (query: string) => ['mcp-key', 'members', query] as const,
  matrix: ['mcp-key', 'matrix'] as const,
}

export function useMyMcpKeyViewModel() {
  const { t } = useTranslation('mcp')
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const queryClient = useQueryClient()
  // The secret lives only in this state. It is gone once the member dismisses it or leaves the page.
  const [secret, setSecret] = useState<string | null>(null)

  const keyQuery = useQuery({ queryKey: mcpKeyQueryKeys.mine, queryFn: () => mcpKeysService.myKey(token), enabled: signedIn })
  const guideQuery = useQuery({ queryKey: mcpKeyQueryKeys.guide, queryFn: () => mcpKeysService.myGuide(token), enabled: signedIn })
  const claim = useMutation({
    mutationFn: (keyId: string) => mcpKeysService.claim(token, keyId),
    onSuccess: (result) => {
      setSecret(result.secret)
      queryClient.setQueryData(mcpKeyQueryKeys.mine, result.key)
    },
  })

  const failure = keyQuery.error ?? claim.error
  const mcpKey = keyQuery.data ?? null

  return {
    status: keyQuery.isPending ? ('loading' as const) : mcpKey ? ('ready' as const) : ('empty' as const),
    mcpKey,
    canClaim: mcpKey?.status === 'pending',
    needsNewKey: mcpKey !== null && mcpKey.status !== 'pending' && mcpKey.status !== 'active',
    isClaiming: claim.isPending,
    onClaim: () => mcpKey && claim.mutate(mcpKey.id),
    secret,
    dismissSecret: () => setSecret(null),
    guide: guideQuery.data ?? null,
    snippets: setupSnippets(absoluteApiUrl('/api/mcp')),
    error: failure ? readErrorMessage(failure, t(MCP_ACCESS_TEXT.error)) : null,
  }
}
