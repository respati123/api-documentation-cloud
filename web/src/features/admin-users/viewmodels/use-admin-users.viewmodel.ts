import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ADMIN_USERS_TEXT } from '@/features/admin-users/constants/admin-users-text.constants'
import { ADMIN_USERS_PAGE_SIZE, adminUsersService } from '@/features/admin-users/services/admin-users.service'
import { useAuthSessionStore } from '@/features/auth'
import type { UserRole } from '@/shared/models/user-role.model'
import { showToast } from '@/shared/toast/toast-manager'
import { readErrorMessage } from '@/shared/utils/error-message'

export const adminUsersKeys = {
  users: (query: string) => ['admin-users', 'users', query] as const,
  invites: ['admin-users', 'invites'] as const,
  roles: ['admin-users', 'roles'] as const,
}

export function useAdminUsersViewModel() {
  const { t } = useTranslation('admin')
  const token = useAuthSessionStore((state) => state.token)
  const isAdmin = useAuthSessionStore((state) => state.isAdmin)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [email, setEmail] = useState('')
  const [roleName, setRoleName] = useState('')
  const [latestLink, setLatestLink] = useState('')
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole[]>>({})
  const [userCursors, setUserCursors] = useState<Array<string | null>>([null])
  const [inviteCursors, setInviteCursors] = useState<Array<string | null>>([null])
  const query = useDeferredValue(search)
  const userCursor = userCursors[userCursors.length - 1] ?? null
  const inviteCursor = inviteCursors[inviteCursors.length - 1] ?? null

  const users = useQuery({
    queryKey: [...adminUsersKeys.users(query), userCursor],
    queryFn: () => adminUsersService.users(token, query, userCursor),
    enabled: isAdmin,
  })
  const invites = useQuery({
    queryKey: [...adminUsersKeys.invites, inviteCursor],
    queryFn: () => adminUsersService.invites(token, inviteCursor),
    enabled: isAdmin,
  })
  const roles = useQuery({
    queryKey: adminUsersKeys.roles,
    queryFn: () => adminUsersService.roles(token),
    enabled: isAdmin,
  })

  function setUsersSearch(value: string) {
    setSearch(value)
    setUserCursors([null])
  }

  function goToNextUserPage() {
    const cursor = users.data?.nextCursor
    if (cursor) setUserCursors((current) => [...current, cursor])
  }

  function goToPreviousUserPage() {
    setUserCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))
  }

  function resetInvitePages() {
    setInviteCursors([null])
  }

  function goToNextInvitePage() {
    const cursor = invites.data?.nextCursor
    if (cursor) setInviteCursors((current) => [...current, cursor])
  }

  function goToPreviousInvitePage() {
    setInviteCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))
  }

  const invite = useMutation({
    mutationFn: () => adminUsersService.invite(token, email.trim()),
    onSuccess: (result) => {
      setEmail('')
      setLatestLink(result.emailSent ? '' : result.inviteUrl)
      showToast({
        kind: result.emailSent ? 'success' : 'info',
        message: t(result.emailSent ? ADMIN_USERS_TEXT.invitationSent : ADMIN_USERS_TEXT.invitationCreated, { email: result.email }),
      })
      resetInvitePages()
      void queryClient.invalidateQueries({ queryKey: adminUsersKeys.invites })
    },
  })

  const cancel = useMutation({
    mutationFn: (inviteId: string) => adminUsersService.cancelInvite(token, inviteId),
    onSuccess: () => {
      resetInvitePages()
      void queryClient.invalidateQueries({ queryKey: adminUsersKeys.invites })
    },
  })

  const roleChange = useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: UserRole[] }) => adminUsersService.setRoles(token, userId, roles),
    onSuccess: (_result, variables) => {
      setRoleDrafts((current) => {
        const { [variables.userId]: _saved, ...remaining } = current
        return remaining
      })
      void queryClient.invalidateQueries({ queryKey: ['admin-users', 'users'] })
    },
  })

  const createRole = useMutation({
    mutationFn: () => adminUsersService.createRole(token, roleName.trim()),
    onSuccess: () => {
      setRoleName('')
      showToast({ kind: 'success', message: t(ADMIN_USERS_TEXT.roleCreated) })
      void queryClient.invalidateQueries({ queryKey: adminUsersKeys.roles })
    },
  })

  const deleteRole = useMutation({
    mutationFn: (roleId: string) => adminUsersService.deleteRole(token, roleId),
    onSuccess: () => {
      setRoleDrafts({})
      void queryClient.invalidateQueries({ queryKey: adminUsersKeys.roles })
      void queryClient.invalidateQueries({ queryKey: ['admin-users', 'users'] })
    },
  })

  function rolesForUser(userId: string, assignedRoles: UserRole[]) {
    return roleDrafts[userId] ?? assignedRoles
  }

  function hasRoleDraftChanges(userId: string, assignedRoles: UserRole[]) {
    const draft = roleDrafts[userId]
    return Boolean(draft && !sameRoles(draft, assignedRoles))
  }

  function saveUserRoles(userId: string, assignedRoles: UserRole[]) {
    const draft = roleDrafts[userId]
    if (draft && !sameRoles(draft, assignedRoles)) roleChange.mutate({ userId, roles: draft })
  }

  function onCreateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (roleName.trim()) createRole.mutate()
  }

  function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (email.trim()) invite.mutate()
  }

  async function copyLink() {
    if (!latestLink) return
    try {
      await navigator.clipboard.writeText(latestLink)
      showToast({ kind: 'success', message: t(ADMIN_USERS_TEXT.copied) })
    } catch {
      showToast({ kind: 'error', message: t(ADMIN_USERS_TEXT.copyFailed) })
    }
  }

  return {
    search,
    setSearch: setUsersSearch,
    email,
    setEmail,
    roleName,
    setRoleName,
    onCreateRole,
    isCreatingRole: createRole.isPending,
    createRoleError: createRole.error ? readErrorMessage(createRole.error, t(ADMIN_USERS_TEXT.roleCreateError)) : null,
    onDeleteRole: (roleId: string) => deleteRole.mutate(roleId),
    deletingRoleId: deleteRole.isPending ? deleteRole.variables : null,
    deleteRoleError: deleteRole.error ? readErrorMessage(deleteRole.error, t(ADMIN_USERS_TEXT.roleDeleteError)) : null,
    latestLink,
    copyLink,
    onInvite,
    onCancelInvite: (inviteId: string) => cancel.mutate(inviteId),
    isInviting: invite.isPending,
    inviteError: invite.error ? readErrorMessage(invite.error, t(ADMIN_USERS_TEXT.inviteError)) : null,
    cancelError: cancel.error ? readErrorMessage(cancel.error, t(ADMIN_USERS_TEXT.loadError)) : null,
    users: users.data?.items ?? [],
    usersStatus: users.isPending ? ('loading' as const) : users.data?.items.length ? ('ready' as const) : ('empty' as const),
    usersError: users.error ? readErrorMessage(users.error, t(ADMIN_USERS_TEXT.loadError)) : null,
    roles: roles.data ?? [],
    rolesLoading: roles.isPending,
    rolesError: roles.error ? readErrorMessage(roles.error, t(ADMIN_USERS_TEXT.loadError)) : null,
    roleError: roleChange.error ? readErrorMessage(roleChange.error, t(ADMIN_USERS_TEXT.roleUpdateError)) : null,
    updatingRoleUserId: roleChange.isPending ? roleChange.variables.userId : null,
    roleDrafts,
    onRolesChange: (userId: string, assignedRoles: UserRole[]) => setRoleDrafts((current) => ({ ...current, [userId]: assignedRoles })),
    rolesForUser,
    hasRoleDraftChanges,
    saveUserRoles,
    usersPage: userCursors.length,
    usersTotalPages: Math.max(1, Math.ceil((users.data?.total ?? 0) / ADMIN_USERS_PAGE_SIZE)),
    usersHasPrevious: userCursors.length > 1,
    usersHasNext: Boolean(users.data?.nextCursor),
    goToPreviousUserPage,
    goToNextUserPage,
    invites: invites.data?.items ?? [],
    invitesStatus: invites.isPending ? ('loading' as const) : invites.data?.items.length ? ('ready' as const) : ('empty' as const),
    invitesError: invites.error ? readErrorMessage(invites.error, t(ADMIN_USERS_TEXT.loadError)) : null,
    invitesPage: inviteCursors.length,
    invitesTotalPages: Math.max(1, Math.ceil((invites.data?.total ?? 0) / ADMIN_USERS_PAGE_SIZE)),
    invitesHasPrevious: inviteCursors.length > 1,
    invitesHasNext: Boolean(invites.data?.nextCursor),
    goToPreviousInvitePage,
    goToNextInvitePage,
    cancellingInviteId: cancel.isPending ? cancel.variables : null,
  }
}

function sameRoles(first: UserRole[], second: UserRole[]) {
  return first.length === second.length && first.every((role) => second.includes(role))
}
