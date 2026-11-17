import * as z from 'zod/mini'

export const adminWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerEmail: z.string(),
  memberCount: z.number(),
  createdAt: z.string(),
})

export type AdminWorkspace = z.infer<typeof adminWorkspaceSchema>
