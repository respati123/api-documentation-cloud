import { useDeferredValue, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminUser, RoleMaster, UserInvite, UserInviteResult } from '../models/portal.model'
import { portalService } from '../services/portal.service'
import { portalKeys } from './portal.keys'

// Admin pages: user accounts and their roles, pending invitations, and the role master list.
export function useAdminUsersViewModel({ authenticated, isAdmin, active, currentUserId }: { authenticated: boolean; isAdmin: boolean; active: boolean; currentUserId?: string }) {
  const queryClient = useQueryClient()
  const enabled = authenticated && isAdmin && active
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteResult, setInviteResult] = useState<UserInviteResult | null>(null)
  const [newRoleName, setNewRoleName] = useState('')
  const [createRoleOpen, setCreateRoleOpen] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState<RoleMaster | null>(null)

  const users = useInfiniteQuery({
    queryKey: portalKeys.adminUsers(deferredSearch),
    queryFn: ({ pageParam }) => portalService.adminUsers(deferredSearch, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled,
  })
  const roles = useQuery({ queryKey: portalKeys.adminRoles, queryFn: portalService.adminRoles, enabled })
  const invites = useInfiniteQuery({
    queryKey: portalKeys.adminInvites,
    queryFn: ({ pageParam }) => portalService.adminUserInvites(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled,
  })

  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ['portal', 'admin-users'] })
  const refreshInvites = () => queryClient.invalidateQueries({ queryKey: portalKeys.adminInvites })
  const refreshRoles = () => queryClient.invalidateQueries({ queryKey: portalKeys.adminRoles })

  const saveRoles = useMutation({
    mutationFn: ({ userId, roleIds, appAdmin }: { userId: string; roleIds: string[]; appAdmin?: boolean }) =>
      portalService.updateAdminUser(userId, appAdmin === undefined ? { roles: roleIds } : { roles: roleIds, isAdmin: appAdmin }),
    onSuccess: async () => {
      setEditUser(null)
      await refreshUsers()
    },
  })
  const createRole = useMutation({
    mutationFn: (name: string) => portalService.createAdminRole(name),
    onSuccess: async () => {
      setNewRoleName('')
      setCreateRoleOpen(false)
      await refreshRoles()
    },
  })
  const deleteRole = useMutation({
    mutationFn: (role: RoleMaster) => portalService.deleteAdminRole(role.id),
    onSuccess: async () => {
      setRoleToDelete(null)
      await Promise.all([refreshRoles(), refreshUsers()])
    },
  })
  const sendInvite = useMutation({
    mutationFn: (email: string) => portalService.inviteUser(email),
    onSuccess: async result => {
      setInviteResult(result)
      setInviteEmail('')
      await refreshInvites()
    },
  })
  const cancelInvite = useMutation({
    mutationFn: (invite: UserInvite) => portalService.cancelUserInvite(invite.id),
    onSuccess: refreshInvites,
  })

  const roleList = roles.data ?? []
  const roleNames = new Map(roleList.map(role => [role.id, role.name]))
  const allUsers = users.data?.pages.flatMap(page => page.items) ?? []
  const allInvites = invites.data?.pages.flatMap(page => page.items) ?? []

  return {
    users: {
      items: allUsers,
      search,
      setSearch,
      status: users.isPending ? 'loading' as const : users.isError ? 'error' as const : allUsers.length ? 'ready' as const : 'empty' as const,
      error: users.error,
      retry: () => void users.refetch(),
      hasNextPage: users.hasNextPage,
      isFetchingNextPage: users.isFetchingNextPage,
      loadMore: () => void users.fetchNextPage(),
      roleName: (roleId: string) => roleNames.get(roleId) ?? roleId,
      editUser,
      openEdit: (user: AdminUser) => {
        saveRoles.reset()
        setEditUser(user)
      },
      closeEdit: () => setEditUser(null),
      currentUserId,
      saveRoles: (userId: string, roleIds: string[], appAdmin?: boolean) => saveRoles.mutate({ userId, roleIds, appAdmin }),
      savePending: saveRoles.isPending,
      saveError: saveRoles.error,
    },
    roles: {
      items: roleList,
      status: roles.isPending ? 'loading' as const : roles.isError ? 'error' as const : 'ready' as const,
      error: roles.error,
      retry: () => void roles.refetch(),
      newName: newRoleName,
      setNewName: setNewRoleName,
      createOpen: createRoleOpen,
      setCreateOpen: (open: boolean) => {
        createRole.reset()
        setNewRoleName('')
        setCreateRoleOpen(open)
      },
      create: () => createRole.mutate(newRoleName.trim()),
      createPending: createRole.isPending,
      createError: createRole.error,
      roleToDelete,
      askDelete: setRoleToDelete,
      closeDelete: () => setRoleToDelete(null),
      confirmDelete: () => roleToDelete && deleteRole.mutate(roleToDelete),
      deletePending: deleteRole.isPending,
      deleteError: deleteRole.error,
    },
    invites: {
      items: allInvites,
      status: invites.isPending ? 'loading' as const : invites.isError ? 'error' as const : allInvites.length ? 'ready' as const : 'empty' as const,
      error: invites.error,
      retry: () => void invites.refetch(),
      hasNextPage: invites.hasNextPage,
      isFetchingNextPage: invites.isFetchingNextPage,
      loadMore: () => void invites.fetchNextPage(),
      open: inviteOpen,
      setOpen: (open: boolean) => {
        setInviteOpen(open)
        if (!open) {
          setInviteResult(null)
          sendInvite.reset()
        }
      },
      email: inviteEmail,
      setEmail: setInviteEmail,
      send: () => sendInvite.mutate(inviteEmail.trim()),
      sendPending: sendInvite.isPending,
      sendError: sendInvite.error,
      result: inviteResult,
      cancel: (invite: UserInvite) => cancelInvite.mutate(invite),
      cancellingId: cancelInvite.isPending ? cancelInvite.variables?.id ?? null : null,
      cancelError: cancelInvite.error,
    },
  }
}

export type AdminUsersViewModel = ReturnType<typeof useAdminUsersViewModel>
