import { data, request } from '@/lib/api'
import type {
  AdminUser,
  AdminWorkspace,
  RoleMaster,
  UserInvite,
  UserInviteResult,
  ApiNode,
  CollectionBranch,
  Commit,
  Member,
  MemberOption,
  MemberRole,
  AdminMcpKey,
  McpKey,
  McpKeyValidDays,
  McpGuide,
  McpWorkspaceAccess,
  NotificationInbox,
  Page,
  Snapshot,
  User,
  Workspace,
  WorkspaceInvite,
} from '../models/portal.model'

async function page<T>(path: string, key: string, cursor?: string | null): Promise<Page<T>> {
  const separator = path.includes('?') ? '&' : '?'
  const cursorParam = cursor ? `${separator}cursor=${encodeURIComponent(cursor)}` : ''
  const result = await request<{
    data?: Record<string, T[]>
    meta?: { nextCursor?: string }
    [key: string]: unknown
  }>(`${path}${cursorParam}`)
  const payload = data<Record<string, T[]>>(result)

  return { items: payload[key] ?? [], nextCursor: result.meta?.nextCursor ?? null }
}

export const portalService = {
  me: async () => data<{ user: User }>(await request('/api/me')).user,

  authenticate: async (mode: string, email: string, password: string, token: string) => {
    const path = mode === 'forgot' ? 'forgot-password' : mode === 'reset' ? 'reset-password' : mode
    const body = mode === 'forgot'
      ? { email }
      : mode === 'reset'
        ? { token, password }
        : mode === 'register'
          ? { email, password, inviteToken: token }
          : { email, password }

    await request(`/api/auth/${path}`, 'POST', body)
  },

  logout: () => request('/api/auth/logout', 'POST'),

  workspaces: (cursor?: string | null) => page<Workspace>('/api/workspaces', 'workspaces', cursor),

  notifications: async () => data<NotificationInbox>(await request('/api/me/notifications?limit=20')),

  markNotificationRead: (id: string) =>
    request(`/api/me/notifications/${encodeURIComponent(id)}/read`, 'POST'),

  markAllNotificationsRead: () => request('/api/me/notifications/read-all', 'POST'),

  create: async (name: string) => data<{ workspace: Workspace }>(
    await request('/api/workspaces', 'POST', { name, tree: [], variables: { globals: [], environments: [] } }),
  ).workspace,

  renameWorkspace: async (id: string, name: string) => data<{ workspace: Workspace }>(
    await request(`/api/workspaces/${encodeURIComponent(id)}`, 'PATCH', { name }),
  ).workspace,

  deleteWorkspace: (id: string, confirmName: string) =>
    request(`/api/workspaces/${encodeURIComponent(id)}`, 'DELETE', { confirmName }),

  snapshot: async (id: string) => {
    const workspace = data<{ workspace: Snapshot | null }>(
      await request(`/api/workspaces/${encodeURIComponent(id)}/sync/pull`),
    ).workspace

    if (!workspace?.usesBranches) return workspace

    const { branches } = data<{ branches: CollectionBranch[] }>(
      await request(`/api/workspaces/${encodeURIComponent(id)}/branches`),
    )
    const trees = await Promise.all(
      branches.map(async branch => data<{ tree: ApiNode[] }>(
        await request(
          `/api/workspaces/${encodeURIComponent(id)}/branches/${encodeURIComponent(branch.id)}/pull`,
        ),
      ).tree),
    )

    return { ...workspace, tree: trees.flat(), branches }
  },

  members: (id: string, cursor?: string | null) =>
    page<Member>(`/api/workspaces/${encodeURIComponent(id)}/members`, 'members', cursor),

  memberOptions: (id: string, query: string, cursor?: string | null) =>
    page<MemberOption>(
      `/api/workspaces/${encodeURIComponent(id)}/member-options?q=${encodeURIComponent(query)}`,
      'users',
      cursor,
    ),

  addMember: (id: string, userId: string, role: MemberRole) =>
    request(`/api/workspaces/${encodeURIComponent(id)}/members`, 'POST', { userId, role }),

  changeMemberRole: (id: string, memberId: string, role: MemberRole) =>
    request(`/api/workspaces/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`, 'PATCH', { role }),

  removeMember: (id: string, memberId: string) =>
    request(`/api/workspaces/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`, 'DELETE'),

  invites: (id: string, cursor?: string | null) =>
    page<WorkspaceInvite>(`/api/workspaces/${encodeURIComponent(id)}/invites`, 'invites', cursor),

  cancelInvite: (id: string, inviteId: string) =>
    request(`/api/workspaces/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}`, 'DELETE'),

  acceptInvite: async (token: string) => data<{ workspace: { id: string; name: string } }>(
    await request('/api/invites/accept', 'POST', { token }),
  ).workspace,

  history: (id: string, cursor?: string | null) =>
    page<Commit>(`/api/workspaces/${encodeURIComponent(id)}/sync/history`, 'commits', cursor),

  branchHistory: (id: string, branchId: string, cursor?: string | null) =>
    page<Commit>(
      `/api/workspaces/${encodeURIComponent(id)}/branches/${encodeURIComponent(branchId)}/history`,
      'commits',
      cursor,
    ),

  myMcpKeys: async () => data<{ keys: McpKey[]; limit: number }>(await request('/api/me/mcp-keys')),

  createMcpKey: async (input: { name: string; validDays: McpKeyValidDays }) =>
    data<{ secret: string; key: McpKey }>(await request('/api/me/mcp-keys', 'POST', input)),

  revokeMcpKey: (keyId: string) => request(`/api/me/mcp-keys/${encodeURIComponent(keyId)}`, 'DELETE'),

  mcpAccess: async () => data<{ workspaces: McpWorkspaceAccess[] }>(await request('/api/me/mcp-access')).workspaces,

  mcpGuide: async () => data<{ guide: McpGuide }>(await request('/api/me/mcp-guide')).guide,

  adminMcpKeys: (search: string, cursor?: string | null) => {
    const query = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''
    return page<AdminMcpKey>(`/api/admin/mcp-keys${query}`, 'keys', cursor)
  },

  revokeAdminMcpKey: (keyId: string) => request(`/api/admin/mcp-keys/${encodeURIComponent(keyId)}`, 'DELETE'),

  adminRoles: async () => data<{ roles: RoleMaster[] }>(await request('/api/admin/roles')).roles,
  createAdminRole: async (name: string) => data<RoleMaster>(await request('/api/admin/roles', 'POST', { name })),
  deleteAdminRole: (roleId: string) => request(`/api/admin/roles/${encodeURIComponent(roleId)}`, 'DELETE'),
  adminUsers: (search: string, cursor?: string | null) => {
    const query = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''
    return page<AdminUser>(`/api/admin/users${query}`, 'users', cursor)
  },
  updateAdminUser: (userId: string, changes: { roles?: string[]; isAdmin?: boolean }) =>
    request(`/api/admin/users/${encodeURIComponent(userId)}`, 'PATCH', changes),
  adminWorkspaces: (search: string, cursor?: string | null) => {
    const query = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''
    return page<AdminWorkspace>(`/api/admin/workspaces${query}`, 'workspaces', cursor)
  },
  adminUserInvites: (cursor?: string | null) => page<UserInvite>('/api/admin/user-invites', 'invites', cursor),
  inviteUser: async (email: string) => data<UserInviteResult>(await request('/api/admin/user-invites', 'POST', { email })),
  cancelUserInvite: (inviteId: string) => request(`/api/admin/user-invites/${encodeURIComponent(inviteId)}`, 'DELETE'),

  // The desktop's public key seals the session, so only that desktop app can open the returned box.
  approveDesktopLogin: async (publicKey: string) =>
    data<{ box: string }>(await request('/api/desktop-login/approve', 'POST', { publicKey })).box,
}
