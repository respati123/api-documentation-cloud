import * as z from 'zod/mini'
import { userSchema } from '@/shared/models/user.model'

export const authSessionSchema = z.object({
  token: z.string(),
  user: userSchema,
})

export const currentUserResponseSchema = z.object({
  user: userSchema,
})

export const okResponseSchema = z.object({
  ok: z.literal(true),
})

export type CloudUser = z.infer<typeof userSchema>
export type AuthSession = z.infer<typeof authSessionSchema>
export type AuthMode = 'login' | 'register' | 'forgot' | 'reset'
