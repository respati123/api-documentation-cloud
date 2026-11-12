import * as z from 'zod/mini'

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  // Only /api/me reports it. Sign-in responses leave it out, and the portal reads /api/me after sign-in.
  isAdmin: z.optional(z.boolean()),
})

export type CloudUser = z.infer<typeof userSchema>
