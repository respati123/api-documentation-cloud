import * as z from 'zod/mini'

export const MCP_KEY_ROLES = ['pm', 'tech_lead', 'ui_ux', 'backend', 'frontend', 'mobile', 'qa'] as const
export const MCP_KEY_STATUSES = ['pending', 'claim_expired', 'active', 'expired', 'revoked'] as const

export const mcpKeyRoleSchema = z.enum(MCP_KEY_ROLES)
export const mcpKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  role: mcpKeyRoleSchema,
  tools: z.array(z.string()),
  validDays: z.number(),
  status: z.enum(MCP_KEY_STATUSES),
  claimExpiresAt: z.string(),
  claimedAt: z.nullable(z.string()),
  expiresAt: z.nullable(z.string()),
  lastUsedAt: z.nullable(z.string()),
  revokedAt: z.nullable(z.string()),
  createdAt: z.string(),
})
export const mcpKeyMemberSchema = z.object({
  userId: z.string(),
  email: z.string(),
  workspaceCount: z.number(),
  key: z.nullable(mcpKeySchema),
})
export const mcpToolMatrixSchema = z.object({
  tools: z.array(z.string()),
  roles: z.record(mcpKeyRoleSchema, z.array(z.string())),
})
export const mcpGuideSchema = z.object({ role: mcpKeyRoleSchema, version: z.string(), guide: z.string() })

export const claimedKeySchema = z.object({ secret: z.string(), key: mcpKeySchema })

export type McpKeyRole = z.infer<typeof mcpKeyRoleSchema>
export type McpKey = z.infer<typeof mcpKeySchema>
export type McpKeyStatus = McpKey['status']
export type McpKeyMember = z.infer<typeof mcpKeyMemberSchema>
export type McpGuide = z.infer<typeof mcpGuideSchema>
export type McpToolMatrix = z.infer<typeof mcpToolMatrixSchema>
// "missing" is a member without any key yet. The server statuses cover every other row.
export type McpMemberKeyState = McpKeyStatus | 'missing'

export interface IssueKeyInput {
  userId: string
  name: string
  role: McpKeyRole
  tools: string[]
  validDays: number
}
