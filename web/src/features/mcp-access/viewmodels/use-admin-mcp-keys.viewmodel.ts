import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { MCP_ACCESS_TEXT } from '@/features/mcp-access/constants/mcp-access-text.constants'
import type { AdminMcpKey } from '@/features/mcp-access/models/mcp-key.model'
import { mcpKeysService } from '@/features/mcp-access/services/mcp-keys.service'
import { mcpKeyQueryKeys } from '@/features/mcp-access/viewmodels/use-my-mcp-key.viewmodel'
import { usePageList } from '@/shared/hooks/use-page-list'
import { showToast } from '@/shared/toast/toast-manager'
import { readErrorMessage } from '@/shared/utils/error-message'

// Members create their own keys. The admin watches every key and revokes one when it should stop working.
export function useAdminMcpKeysViewModel() {
  const { t } = useTranslation('mcp')
  const token = useAuthSessionStore((state) => state.token)
  const isAdmin = useAuthSessionStore((state) => state.isAdmin)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const query = useDeferredValue(search)

  const keys = usePageList({
    queryKey: mcpKeyQueryKeys.admin(query),
    fetchPage: (cursor) => mcpKeysService.adminKeys(token, query, cursor),
    enabled: isAdmin,
  })
  const revoke = useMutation({
    mutationFn: (key: AdminMcpKey) => mcpKeysService.adminRevoke(token, key.id),
    onSuccess: async (_result, key) => {
      showToast({ kind: 'success', message: t(MCP_ACCESS_TEXT.admin.revoked, { name: key.name, email: key.owner.email }) })
      await queryClient.invalidateQueries({ queryKey: mcpKeyQueryKeys.all })
    },
  })
  const failure = keys.error ?? revoke.error

  return {
    isAdmin,
    search,
    setSearch,
    keys: keys.items,
    status: keys.isPending ? ('loading' as const) : keys.items.length ? ('ready' as const) : ('empty' as const),
    hasMore: keys.hasMore,
    isLoadingMore: keys.isLoadingMore,
    loadMore: keys.loadMore,
    revokingId: revoke.isPending ? (revoke.variables?.id ?? null) : null,
    onRevoke: (key: AdminMcpKey) => revoke.mutate(key),
    error: failure ? readErrorMessage(failure, t(MCP_ACCESS_TEXT.error)) : null,
  }
}
