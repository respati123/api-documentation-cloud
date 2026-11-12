import * as z from 'zod/mini'
import { type AdminWorkspace, adminWorkspaceSchema } from '@/features/admin-workspaces/models/admin-workspace.model'
import type { Page } from '@/shared/models/page.model'
import { apiPage } from '@/shared/services/api-client'
import { pageQuery } from '@/shared/utils/page-query'

export const adminWorkspacesService = {
  list: async (token: string, query: string, cursor: string | null): Promise<Page<AdminWorkspace>> => {
    const search = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''
    const page = await apiPage(`/api/admin/workspaces${pageQuery(cursor)}${search}`, { token })
    return { items: z.parse(z.object({ workspaces: z.array(adminWorkspaceSchema) }), page.data).workspaces, nextCursor: page.nextCursor }
  },
}
