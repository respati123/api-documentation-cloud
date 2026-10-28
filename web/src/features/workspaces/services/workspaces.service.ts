import * as z from 'zod/mini'
import { type CloudWorkspaceRef, workspaceRefSchema } from '@/shared/models/workspace.model'
import { apiCall, apiPage } from '@/shared/services/api-client'
import { pageQuery } from '@/shared/utils/page-query'

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
  listPage: async (token: string, cursor: string | null): Promise<{ items: CloudWorkspaceRef[]; nextCursor: string | null }> => {
    const page = await apiPage(`/api/workspaces${pageQuery(cursor)}`, { token })
    return { items: z.parse(listResponseSchema, page.data).workspaces, nextCursor: page.nextCursor }
  },

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
