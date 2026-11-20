import * as z from 'zod/mini'

export const userRoleSchema = z.string()
export type UserRole = z.infer<typeof userRoleSchema>
