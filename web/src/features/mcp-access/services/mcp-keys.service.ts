import * as z from 'zod/mini'
import {
  claimedKeySchema,
  type IssueKeyInput,
  mcpGuideSchema,
  mcpKeyMemberSchema,
  mcpKeySchema,
  mcpToolMatrixSchema,
} from '@/features/mcp-access/models/mcp-key.model'
import type { Page } from '@/shared/models/page.model'
import { apiCall, apiPage } from '@/shared/services/api-client'
import { pageQuery } from '@/shared/utils/page-query'

const issuedSchema = z.object({ key: mcpKeySchema, emailSent: z.boolean() })

export const mcpKeysService = {
  myKey: async (token: string) => z.parse(z.object({ key: z.nullable(mcpKeySchema) }), await apiCall('/api/me/mcp-key', { token })).key,
  myGuide: async (token: string) =>
    z.parse(z.object({ guide: z.nullable(mcpGuideSchema) }), await apiCall('/api/me/mcp-guide', { token })).guide,
  claim: async (token: string, keyId: string) =>
    z.parse(claimedKeySchema, await apiCall(`/api/me/mcp-key/${encodeURIComponent(keyId)}/claim`, { token, method: 'POST' })),
  members: async (token: string, query: string, cursor: string | null): Promise<Page<z.infer<typeof mcpKeyMemberSchema>>> => {
    const search = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''
    const page = await apiPage(`/api/admin/mcp-keys${pageQuery(cursor)}${search}`, { token })
    return { items: z.parse(z.object({ members: z.array(mcpKeyMemberSchema) }), page.data).members, nextCursor: page.nextCursor }
  },
  toolMatrix: async (token: string) => z.parse(mcpToolMatrixSchema, await apiCall('/api/admin/mcp-tools', { token })),
  issue: async (token: string, input: IssueKeyInput) =>
    z.parse(issuedSchema, await apiCall('/api/admin/mcp-keys', { token, method: 'POST', body: input })),
  reissue: async (token: string, keyId: string) =>
    z.parse(issuedSchema, await apiCall(`/api/admin/mcp-keys/${encodeURIComponent(keyId)}/reissue`, { token, method: 'POST' })),
  revoke: async (token: string, keyId: string) => apiCall(`/api/admin/mcp-keys/${encodeURIComponent(keyId)}`, { token, method: 'DELETE' }),
}
