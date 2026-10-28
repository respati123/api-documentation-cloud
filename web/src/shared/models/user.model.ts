import * as z from 'zod/mini'

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
})

export type CloudUser = z.infer<typeof userSchema>
