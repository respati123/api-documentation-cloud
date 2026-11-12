import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNoticeStore } from '@/features/app-shell'
import { useAuthSessionStore } from '@/features/auth'
import { MCP_ACCESS_TEXT } from '@/features/mcp-access/constants/mcp-access-text.constants'
import type { McpKeyMember, McpKeyRole, McpMemberKeyState } from '@/features/mcp-access/models/mcp-key.model'
import { mcpKeysService } from '@/features/mcp-access/services/mcp-keys.service'
import { mcpKeyQueryKeys } from '@/features/mcp-access/viewmodels/use-my-mcp-key.viewmodel'
import { usePageList } from '@/shared/hooks/use-page-list'
import { readErrorMessage } from '@/shared/utils/error-message'

interface IssueDraft {
  member: McpKeyMember
  name: string
  role: McpKeyRole
  tools: string[]
  validDays: number
}

export function memberKeyState(member: McpKeyMember): McpMemberKeyState {
  return member.key?.status ?? 'missing'
}

export function useAdminMcpKeysViewModel() {
  const { t } = useTranslation('mcp')
  const token = useAuthSessionStore((state) => state.token)
  const isAdmin = useAuthSessionStore((state) => state.isAdmin)
  const showNotice = useNoticeStore((state) => state.show)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const query = useDeferredValue(search)
  const [draft, setDraft] = useState<IssueDraft | null>(null)

  const members = usePageList({
    queryKey: mcpKeyQueryKeys.members(query),
    fetchPage: (cursor) => mcpKeysService.members(token, query, cursor),
    enabled: isAdmin,
  })
  const matrix = useQuery({
    queryKey: mcpKeyQueryKeys.matrix,
    queryFn: () => mcpKeysService.toolMatrix(token),
    enabled: isAdmin,
    staleTime: Infinity,
  })

  const refreshMembers = () => queryClient.invalidateQueries({ queryKey: mcpKeyQueryKeys.all })
  const announceIssued = (email: string, emailSent: boolean) =>
    showNotice({ kind: 'success', message: t(emailSent ? MCP_ACCESS_TEXT.admin.issued : MCP_ACCESS_TEXT.admin.issuedNoEmail, { email }) })

  const issue = useMutation({
    mutationFn: (value: IssueDraft) =>
      mcpKeysService.issue(token, {
        userId: value.member.userId,
        name: value.name.trim(),
        role: value.role,
        tools: value.tools,
        validDays: value.validDays,
      }),
    onSuccess: async (result, value) => {
      setDraft(null)
      announceIssued(value.member.email, result.emailSent)
      await refreshMembers()
    },
  })
  const reissue = useMutation({
    mutationFn: (member: McpKeyMember) => mcpKeysService.reissue(token, member.key?.id ?? ''),
    onSuccess: async (result, member) => {
      announceIssued(member.email, result.emailSent)
      await refreshMembers()
    },
  })
  const revoke = useMutation({
    mutationFn: (keyId: string) => mcpKeysService.revoke(token, keyId),
    onSuccess: async () => {
      showNotice({ kind: 'success', message: t(MCP_ACCESS_TEXT.admin.revoked) })
      await refreshMembers()
    },
  })

  const defaultTools = (role: McpKeyRole) => matrix.data?.roles[role] ?? []
  const listFailure = members.error ?? matrix.error ?? reissue.error ?? revoke.error

  return {
    isAdmin,
    search,
    setSearch,
    members: members.items,
    status: members.isPending ? ('loading' as const) : members.items.length ? ('ready' as const) : ('empty' as const),
    hasMore: members.hasMore,
    isLoadingMore: members.isLoadingMore,
    loadMore: members.loadMore,
    error: listFailure ? readErrorMessage(listFailure, t(MCP_ACCESS_TEXT.error)) : null,
    busyKeyId: reissue.isPending ? reissue.variables?.key?.id : revoke.isPending ? revoke.variables : null,
    onReissue: (member: McpKeyMember) => reissue.mutate(member),
    onRevoke: (keyId: string) => revoke.mutate(keyId),
    allTools: matrix.data?.tools ?? [],
    dialog: draft && {
      ...draft,
      replacesKey: draft.member.key !== null && ['pending', 'active'].includes(draft.member.key.status),
      canSubmit: Boolean(draft.name.trim()) && draft.tools.length > 0 && !issue.isPending,
      isSubmitting: issue.isPending,
      error: issue.error ? readErrorMessage(issue.error, t(MCP_ACCESS_TEXT.error)) : null,
    },
    openDialog: (member: McpKeyMember) => {
      issue.reset()
      const role = member.key?.role ?? 'backend'
      setDraft({ member, name: member.key?.name ?? '', role, tools: defaultTools(role), validDays: member.key?.validDays ?? 90 })
    },
    closeDialog: () => setDraft(null),
    setName: (name: string) => setDraft((current) => current && { ...current, name }),
    setRole: (role: McpKeyRole) => setDraft((current) => current && { ...current, role, tools: defaultTools(role) }),
    toggleTool: (tool: string) =>
      setDraft(
        (current) =>
          current && {
            ...current,
            tools: current.tools.includes(tool) ? current.tools.filter((item) => item !== tool) : [...current.tools, tool],
          },
      ),
    resetTools: () => setDraft((current) => current && { ...current, tools: defaultTools(current.role) }),
    setValidDays: (validDays: number) => setDraft((current) => current && { ...current, validDays }),
    onSubmit: () => draft && issue.mutate(draft),
  }
}
