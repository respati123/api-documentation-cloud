import * as z from 'zod/mini'
import { apiNodeSchema } from '@/shared/models/cloud-workspace.model'

// authorEmail is newer than the endpoint, so an older server leaves it out.
export const commitDetailSchema = z.object({
  id: z.string(),
  parentIds: z.array(z.string()),
  message: z.string(),
  createdAt: z.string(),
  authorEmail: z.optional(z.string()),
  tree: z.array(apiNodeSchema),
})

export type CommitDetail = z.infer<typeof commitDetailSchema>
