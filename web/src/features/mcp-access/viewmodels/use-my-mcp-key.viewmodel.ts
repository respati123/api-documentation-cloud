import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { MCP_ACCESS_TEXT } from '@/features/mcp-access/constants/mcp-access-text.constants'
import type { McpKey, McpKeyValidDays } from '@/features/mcp-access/models/mcp-key.model'
import { mcpKeysService } from '@/features/mcp-access/services/mcp-keys.service'
import { setupSnippets } from '@/features/mcp-access/utils/setup-snippets'
import { absoluteApiUrl } from '@/shared/services/api-client'
import { showToast } from '@/shared/toast/toast-manager'
import { readErrorMessage } from '@/shared/utils/error-message'

export const mcpKeyQueryKeys = {
  all: ['mcp-key'] as const,
  mine: ['mcp-key', 'mine'] as const,
  access: ['mcp-key', 'access'] as const,
  guide: ['mcp-key', 'guide'] as const,
  admin: (query: string) => ['mcp-key', 'admin', query] as const,
}

const DEFAULT_VALID_DAYS: McpKeyValidDays = 90

export function useMyMcpKeyViewModel() {
  const { t } = useTranslation('mcp')
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const queryClient = useQueryClient()
  // The secret lives only in this state. It is gone once the member dismisses it or leaves the page.
  const [created, setCreated] = useState<{ name: string; secret: string } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [validDays, setValidDays] = useState<McpKeyValidDays>(DEFAULT_VALID_DAYS)

  const keysQuery = useQuery({ queryKey: mcpKeyQueryKeys.mine, queryFn: () => mcpKeysService.myKeys(token), enabled: signedIn })
  const accessQuery = useQuery({ queryKey: mcpKeyQueryKeys.access, queryFn: () => mcpKeysService.access(token), enabled: signedIn })
  const guideQuery = useQuery({ queryKey: mcpKeyQueryKeys.guide, queryFn: () => mcpKeysService.myGuide(token), enabled: signedIn })

  const create = useMutation({
    mutationFn: () => mcpKeysService.create(token, { name: name.trim(), validDays }),
    onSuccess: async (result) => {
      setCreated({ name: result.key.name, secret: result.secret })
      setDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: mcpKeyQueryKeys.mine })
    },
  })
  const revoke = useMutation({
    mutationFn: (key: McpKey) => mcpKeysService.revoke(token, key.id),
    onSuccess: async (_result, key) => {
      showToast({ kind: 'success', message: t(MCP_ACCESS_TEXT.table.revoked, { name: key.name }) })
      await queryClient.invalidateQueries({ queryKey: mcpKeyQueryKeys.mine })
    },
  })

  const keys = keysQuery.data?.keys ?? []
  const limit = keysQuery.data?.limit ?? 0
  const activeCount = keys.filter((key) => key.status === 'active').length
  const failure = keysQuery.error ?? accessQuery.error ?? revoke.error

  return {
    status: keysQuery.isPending ? ('loading' as const) : keys.length === 0 ? ('empty' as const) : ('ready' as const),
    keys,
    activeCount,
    limit,
    canCreate: keysQuery.isSuccess && activeCount < limit,
    created,
    dismissCreated: () => setCreated(null),
    dialog: {
      open: dialogOpen,
      name,
      setName,
      validDays,
      setValidDays,
      canSubmit: name.trim().length > 0 && name.trim().length <= 80 && !create.isPending,
      isSubmitting: create.isPending,
      error: create.error ? readErrorMessage(create.error, t(MCP_ACCESS_TEXT.error)) : null,
      onOpen: () => {
        create.reset()
        setName('')
        setValidDays(DEFAULT_VALID_DAYS)
        setDialogOpen(true)
      },
      onClose: () => setDialogOpen(false),
      onSubmit: () => create.mutate(),
    },
    revokingId: revoke.isPending ? (revoke.variables?.id ?? null) : null,
    onRevoke: (key: McpKey) => revoke.mutate(key),
    access: accessQuery.data ?? [],
    accessStatus: accessQuery.isPending ? ('loading' as const) : ('ready' as const),
    guide: guideQuery.data ?? null,
    snippets: created ? setupSnippets(absoluteApiUrl('/api/mcp'), created.secret) : null,
    error: failure ? readErrorMessage(failure, t(MCP_ACCESS_TEXT.error)) : null,
  }
}
