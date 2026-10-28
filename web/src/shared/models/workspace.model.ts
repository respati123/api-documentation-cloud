import * as z from 'zod/mini'

export const workspaceRoleSchema = z.enum(['owner', 'editor', 'viewer'])

export const workspaceRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: workspaceRoleSchema,
  headCommitId: z.nullable(z.string()),
  createdAt: z.string(),
  updatedAt: z.nullable(z.string()),
})

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>
export type CloudWorkspaceRef = z.infer<typeof workspaceRefSchema>
