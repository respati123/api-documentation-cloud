import * as z from 'zod/mini'
import { userRoleSchema } from '@/shared/models/user-role.model'

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  isAdmin: z.boolean(),
  roles: z.array(userRoleSchema),
  createdAt: z.string(),
})

export const roleMasterItemSchema = z.object({ id: z.string(), name: z.string() })

export const userInviteSchema = z.object({
  id: z.string(),
  email: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  createdByEmail: z.string(),
})

export type AdminUser = z.infer<typeof adminUserSchema>
export type RoleMasterItem = z.infer<typeof roleMasterItemSchema>
export type UserInvite = z.infer<typeof userInviteSchema>

export interface UserInviteResult {
  id: string
  email: string
  token: string
  inviteUrl: string
  expiresInDays: number
  emailSent: boolean
}
