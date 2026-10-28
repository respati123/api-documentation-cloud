import { z } from 'zod'

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
})

export const authSessionSchema = z.object({
  token: z.string(),
  user: authUserSchema,
})

export const currentUserResponseSchema = z.object({
  user: authUserSchema,
})

export const okResponseSchema = z.object({
  ok: z.literal(true),
})

export type AuthUser = z.infer<typeof authUserSchema>
export type AuthSession = z.infer<typeof authSessionSchema>
export type AuthMode = 'login' | 'register' | 'forgot' | 'reset'
