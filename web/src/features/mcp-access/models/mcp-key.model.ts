import * as z from 'zod/mini'

export const MCP_KEY_STATUSES = ['active', 'expired', 'revoked'] as const
// null means the key never expires.
export const MCP_KEY_VALID_DAYS = [30, 90, 365, null] as const

export const mcpKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  keySuffix: z.nullable(z.string()),
  status: z.enum(MCP_KEY_STATUSES),
  expiresAt: z.nullable(z.string()),
  lastUsedAt: z.nullable(z.string()),
  revokedAt: z.nullable(z.string()),
  createdAt: z.string(),
})
export const myMcpKeysSchema = z.object({ keys: z.array(mcpKeySchema), limit: z.number() })
export const createdMcpKeySchema = z.object({ secret: z.string(), key: mcpKeySchema })
export const adminMcpKeySchema = z.extend(mcpKeySchema, { owner: z.object({ id: z.string(), email: z.string() }) })
export const mcpWorkspaceAccessSchema = z.object({
  id: z.string(),
  name: z.string(),
  roles: z.array(z.string()),
  tools: z.array(z.string()),
})
export const mcpGuideSchema = z.object({ roles: z.array(z.string()), version: z.string(), guide: z.string() })

export type McpKey = z.infer<typeof mcpKeySchema>
export type McpKeyStatus = McpKey['status']
export type AdminMcpKey = z.infer<typeof adminMcpKeySchema>
export type McpWorkspaceAccess = z.infer<typeof mcpWorkspaceAccessSchema>
export type McpGuide = z.infer<typeof mcpGuideSchema>
export type McpKeyValidDays = (typeof MCP_KEY_VALID_DAYS)[number]
