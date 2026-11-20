import * as z from 'zod/mini'
import {
  type AdminUser,
  adminUserSchema,
  type RoleMasterItem,
  roleMasterItemSchema,
  type UserInvite,
  type UserInviteResult,
  userInviteSchema,
} from '@/features/admin-users/models/admin-user.model'
import type { Page } from '@/shared/models/page.model'
import type { UserRole } from '@/shared/models/user-role.model'
import { apiCall, apiPage } from '@/shared/services/api-client'
import { pageQuery } from '@/shared/utils/page-query'

export const ADMIN_USERS_PAGE_SIZE = 10

const usersResponseSchema = z.object({ users: z.array(adminUserSchema) })
const invitesResponseSchema = z.object({ invites: z.array(userInviteSchema) })
const rolesResponseSchema = z.object({ roles: z.array(roleMasterItemSchema) })
const inviteResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  token: z.string(),
  inviteUrl: z.string(),
  expiresInDays: z.number(),
  emailSent: z.boolean(),
})

export const adminUsersService = {
  roles: async (token: string): Promise<RoleMasterItem[]> =>
    z.parse(rolesResponseSchema, await apiCall('/api/admin/roles', { token })).roles,

  createRole: async (token: string, name: string): Promise<RoleMasterItem> =>
    z.parse(roleMasterItemSchema, await apiCall('/api/admin/roles', { token, method: 'POST', body: { name } })),

  deleteRole: async (token: string, roleId: string): Promise<void> => {
    await apiCall(`/api/admin/roles/${roleId}`, { token, method: 'DELETE' })
  },

  users: async (token: string, query: string, cursor: string | null): Promise<Page<AdminUser>> => {
    const search = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''
    const page = await apiPage(`/api/admin/users${pageQuery(cursor, ADMIN_USERS_PAGE_SIZE)}${search}`, { token })
    return { items: z.parse(usersResponseSchema, page.data).users, nextCursor: page.nextCursor, total: page.total ?? undefined }
  },

  invites: async (token: string, cursor: string | null): Promise<Page<UserInvite>> => {
    const page = await apiPage(`/api/admin/user-invites${pageQuery(cursor, ADMIN_USERS_PAGE_SIZE)}`, { token })
    return { items: z.parse(invitesResponseSchema, page.data).invites, nextCursor: page.nextCursor, total: page.total ?? undefined }
  },

  invite: async (token: string, email: string): Promise<UserInviteResult> =>
    z.parse(inviteResponseSchema, await apiCall('/api/admin/user-invites', { token, method: 'POST', body: { email } })),

  cancelInvite: async (token: string, inviteId: string): Promise<void> => {
    await apiCall(`/api/admin/user-invites/${inviteId}`, { token, method: 'DELETE' })
  },

  setRoles: async (token: string, userId: string, roles: UserRole[]): Promise<void> => {
    await apiCall(`/api/admin/users/${userId}`, { token, method: 'PATCH', body: { roles } })
  },
}
