import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { portalService as service } from '../services/portal.service'
import type { Member, MemberRole } from '../models/portal.model'
import { portalKeys } from './portal.keys'

export function useWorkspaceTeamViewModel({
  workspaceId,
  authenticated,
  canManage,
  currentUserId,
  onLeave,
}: {
  workspaceId: string
  authenticated: boolean
  canManage: boolean
  currentUserId?: string
  onLeave: () => void
}) {
  const queryClient = useQueryClient()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [role, setRole] = useState<MemberRole>('editor')
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)

  const members = useInfiniteQuery({
    queryKey: portalKeys.detail(workspaceId, 'members'),
    queryFn: ({ pageParam }) => service.members(workspaceId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: authenticated && !!workspaceId,
    staleTime: 30000,
  })
  const invites = useInfiniteQuery({
    queryKey: portalKeys.detail(workspaceId, 'invites'),
    queryFn: ({ pageParam }) => service.invites(workspaceId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: authenticated && canManage && !!workspaceId,
    staleTime: 30000,
  })
  const memberOptions = useInfiniteQuery({
    queryKey: portalKeys.memberOptionsSearch(workspaceId, search),
    queryFn: ({ pageParam }) => service.memberOptions(workspaceId, search, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: authenticated && canManage && !!workspaceId && addDialogOpen,
    staleTime: 30000,
  })

  const addMember = useMutation({
    mutationFn: () => service.addMember(workspaceId, selectedUserId, role),
    onSuccess: async () => {
      setAddDialogOpen(false)
      setSearch('')
      setSelectedUserId('')
      setRole('editor')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: portalKeys.workspace(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: portalKeys.memberOptions(workspaceId) }),
      ])
    },
  })
  const changeRole = useMutation({
    mutationFn: ({ memberId, role: nextRole }: { memberId: string; role: MemberRole }) =>
      service.changeMemberRole(workspaceId, memberId, nextRole),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalKeys.workspace(workspaceId) }),
  })
  const removeMember = useMutation({
    mutationFn: (member: Member) => service.removeMember(workspaceId, member.id),
    onSuccess: async (_result, member) => {
      if (member.id === currentUserId) {
        await queryClient.invalidateQueries({ queryKey: portalKeys.workspaces })
        onLeave()
      }
      setRemoveTarget(null)
      await queryClient.invalidateQueries({ queryKey: portalKeys.workspace(workspaceId) })
    },
  })
  const cancelInvite = useMutation({
    mutationFn: (inviteId: string) => service.cancelInvite(workspaceId, inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalKeys.detail(workspaceId, 'invites') }),
  })

  const openAddDialog = () => {
    addMember.reset()
    setSearch('')
    setSelectedUserId('')
    setRole('editor')
    setAddDialogOpen(true)
  }
  const updateSearch = (value: string) => {
    addMember.reset()
    setSelectedUserId('')
    setSearch(value)
  }
  const closeAddDialog = () => {
    if (!addMember.isPending) setAddDialogOpen(false)
  }
  const submitAddMember = () => {
    if (selectedUserId && canManage) addMember.mutate()
  }
  const confirmRemoveMember = () => {
    if (removeTarget) removeMember.mutate(removeTarget)
  }

  return {
    canManage,
    members,
    invites,
    memberOptions,
    addMember,
    changeRole,
    removeMember,
    cancelInvite,
    addDialogOpen,
    openAddDialog,
    closeAddDialog,
    search,
    updateSearch,
    selectedUserId,
    setSelectedUserId,
    role,
    setRole,
    submitAddMember,
    removeTarget,
    setRemoveTarget,
    confirmRemoveMember,
  }
}
