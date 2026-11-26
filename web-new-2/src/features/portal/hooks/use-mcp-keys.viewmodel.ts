import { useCallback, useDeferredValue, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminMcpKey, McpKey, McpKeyValidDays } from '../models/portal.model'
import { portalService } from '../services/portal.service'
import { portalKeys } from './portal.keys'

export function useMcpKeysViewModel({ authenticated, isAdmin, active }: { authenticated: boolean; isAdmin: boolean; active: boolean }) {
  const queryClient = useQueryClient()
  const [createdSecret, setCreatedSecret] = useState<{ name: string; secret: string } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [validDays, setValidDays] = useState<McpKeyValidDays>(90)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  const mine = useQuery({
    queryKey: portalKeys.myMcpKeys,
    queryFn: portalService.myMcpKeys,
    enabled: authenticated && active,
  })
  const access = useQuery({
    queryKey: ['portal', 'mcp-access'],
    queryFn: portalService.mcpAccess,
    enabled: authenticated && active,
  })
  const guide = useQuery({
    queryKey: ['portal', 'mcp-guide'],
    queryFn: portalService.mcpGuide,
    enabled: authenticated && active,
  })
  const create = useMutation({
    mutationFn: () => portalService.createMcpKey({ name: name.trim(), validDays }),
    onSuccess: async result => {
      setCreatedSecret({ name: result.key.name, secret: result.secret })
      setCreateOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: portalKeys.myMcpKeys }),
        queryClient.invalidateQueries({ queryKey: ['portal', 'admin-mcp-keys'] }),
      ])
    },
  })
  const clearSecret = useCallback(() => {
    setCreatedSecret(null)
    create.reset()
  }, [create.reset])
  const revoke = useMutation({
    mutationFn: (key: McpKey) => portalService.revokeMcpKey(key.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: portalKeys.myMcpKeys }),
        queryClient.invalidateQueries({ queryKey: ['portal', 'admin-mcp-keys'] }),
      ])
    },
  })
  const adminKeys = useInfiniteQuery({
    queryKey: portalKeys.adminMcpKeys(deferredSearch),
    queryFn: ({ pageParam }) => portalService.adminMcpKeys(deferredSearch, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: authenticated && isAdmin && active,
  })
  const adminRevoke = useMutation({
    mutationFn: (key: AdminMcpKey) => portalService.revokeAdminMcpKey(key.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portal', 'admin-mcp-keys'] })
      await queryClient.invalidateQueries({ queryKey: portalKeys.myMcpKeys })
    },
  })
  const keys = mine.data?.keys ?? []
  const activeCount = keys.filter(key => key.status === 'active').length
  const allAdminKeys = adminKeys.data?.pages.flatMap(page => page.items) ?? []

  return {
    keys: {
      items: keys,
      limit: mine.data?.limit ?? 0,
      activeCount,
      canCreate: mine.isSuccess && activeCount < (mine.data?.limit ?? 0),
      status: mine.isPending ? 'loading' as const : mine.isError ? 'error' as const : keys.length ? 'ready' as const : 'empty' as const,
      error: mine.error,
      retry: () => void mine.refetch(),
      createdSecret,
      dismissSecret: clearSecret,
      clearSecret,
      createOpen,
      setCreateOpen,
      onOpenCreate: () => {
        create.reset()
        setName('')
        setValidDays(90)
        setCreateOpen(true)
      },
      name,
      setName,
      validDays,
      setValidDays,
      canSubmit: name.trim().length > 0 && name.trim().length <= 80 && !create.isPending,
      createPending: create.isPending,
      createError: create.error,
      submitCreate: () => create.mutate(),
      revokingId: revoke.isPending ? revoke.variables?.id ?? null : null,
      revoke: (key: McpKey) => revoke.mutate(key),
      revokeError: revoke.error,
      access: access.data ?? [],
      accessStatus: access.isPending ? 'loading' as const : access.isError ? 'error' as const : 'ready' as const,
      accessError: access.error,
      retryAccess: () => void access.refetch(),
      guide: guide.data ?? null,
      guideStatus: guide.isPending ? 'loading' as const : guide.isError ? 'error' as const : 'ready' as const,
      guideError: guide.error,
      retryGuide: () => void guide.refetch(),
    },
    admin: {
      search,
      setSearch,
      items: allAdminKeys,
      status: adminKeys.isPending ? 'loading' as const : adminKeys.isError ? 'error' as const : allAdminKeys.length ? 'ready' as const : 'empty' as const,
      error: adminKeys.error,
      retry: () => void adminKeys.refetch(),
      hasNextPage: adminKeys.hasNextPage,
      isFetchingNextPage: adminKeys.isFetchingNextPage,
      loadMore: () => void adminKeys.fetchNextPage(),
      revokingId: adminRevoke.isPending ? adminRevoke.variables?.id ?? null : null,
      revoke: (key: AdminMcpKey) => adminRevoke.mutate(key),
      revokeError: adminRevoke.error,
    },
  }
}

export type McpKeysViewModel = ReturnType<typeof useMcpKeysViewModel>
