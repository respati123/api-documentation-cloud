import * as z from 'zod/mini'
import {
  adminMcpKeySchema,
  createdMcpKeySchema,
  type McpKeyValidDays,
  mcpGuideSchema,
  mcpWorkspaceAccessSchema,
  myMcpKeysSchema,
} from '@/features/mcp-access/models/mcp-key.model'
import type { Page } from '@/shared/models/page.model'
import { apiCall, apiPage } from '@/shared/services/api-client'
import { pageQuery } from '@/shared/utils/page-query'

export const mcpKeysService = {
  myKeys: async (token: string) => z.parse(myMcpKeysSchema, await apiCall('/api/me/mcp-keys', { token })),
  create: async (token: string, input: { name: string; validDays: McpKeyValidDays }) =>
    z.parse(createdMcpKeySchema, await apiCall('/api/me/mcp-keys', { token, method: 'POST', body: input })),
  revoke: async (token: string, keyId: string) => apiCall(`/api/me/mcp-keys/${encodeURIComponent(keyId)}`, { token, method: 'DELETE' }),
  access: async (token: string) =>
    z.parse(z.object({ workspaces: z.array(mcpWorkspaceAccessSchema) }), await apiCall('/api/me/mcp-access', { token })).workspaces,
  myGuide: async (token: string) => z.parse(z.object({ guide: mcpGuideSchema }), await apiCall('/api/me/mcp-guide', { token })).guide,
  adminKeys: async (token: string, query: string, cursor: string | null): Promise<Page<z.infer<typeof adminMcpKeySchema>>> => {
    const search = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''
    const page = await apiPage(`/api/admin/mcp-keys${pageQuery(cursor)}${search}`, { token })
    return { items: z.parse(z.object({ keys: z.array(adminMcpKeySchema) }), page.data).keys, nextCursor: page.nextCursor }
  },
  adminRevoke: async (token: string, keyId: string) =>
    apiCall(`/api/admin/mcp-keys/${encodeURIComponent(keyId)}`, { token, method: 'DELETE' }),
}
