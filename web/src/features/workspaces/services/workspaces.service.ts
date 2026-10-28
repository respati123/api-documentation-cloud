import * as z from 'zod/mini'
import { type CloudWorkspaceRef, workspaceRefSchema } from '@/shared/models/workspace.model'
import { apiCall } from '@/shared/services/api-client'

const listResponseSchema = z.object({
  workspaces: z.array(workspaceRefSchema),
})

const createResponseSchema = z.object({
  workspace: z.object({
    id: z.string(),
    name: z.string(),
  }),
})

export const workspacesService = {
  list: async (token: string): Promise<CloudWorkspaceRef[]> =>
    z.parse(listResponseSchema, await apiCall('/api/workspaces', { token })).workspaces,

  create: async (token: string, name: string) =>
    z.parse(
      createResponseSchema,
      await apiCall('/api/workspaces', {
        method: 'POST',
        token,
        body: { name, tree: [], variables: { globals: [], environments: [] } },
      }),
    ).workspace,
}
