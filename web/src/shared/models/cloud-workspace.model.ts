import * as z from 'zod/mini'
import { type CloudWorkspaceRef, workspaceRoleSchema } from './workspace.model'

export type KeyValueRow = { id: string; name: string; value: string; enabled: boolean; description?: string }

export type RequestNode = {
  id: string
  kind: 'request'
  name: string
  method: string
  url: string
  body: string
  bodyMode?: string
  bodyFields?: Array<{ id: string; name: string; value: string; enabled: boolean; type: 'text' | 'file'; fileName?: string }>
  bodyVariables?: string
  bodyMimeType?: string
  headers?: KeyValueRow[]
  params?: KeyValueRow[]
  pathParams?: KeyValueRow[]
  auth?:
    | { type: 'none' }
    | { type: 'bearer'; token: string }
    | { type: 'basic'; username: string; password: string }
    | { type: 'api-key'; name: string; value: string; location: 'header' | 'query' }
  documentation?: string
  responses?: Array<{
    id: string
    statusCode: string
    description: string
    content: Array<{ id: string; mediaType: string; schema: string; example: string }>
  }>
  deprecated?: boolean
  deprecationReason?: string
}

export type FolderNode = { id: string; kind: 'folder'; name: string; children: ApiNode[] }
export type ApiNode = RequestNode | FolderNode

export type WorkspaceSnapshot = CloudWorkspaceRef & {
  tree: ApiNode[]
  variables?: { globals: unknown[]; environments: unknown[] }
  parentIds?: string[]
  message?: string
}

const keyValueRowSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  value: z.string(),
  enabled: z.boolean(),
  description: z.optional(z.string()),
})

const authSchema = z.union([
  z.looseObject({ type: z.literal('none') }),
  z.looseObject({ type: z.literal('bearer'), token: z.string() }),
  z.looseObject({ type: z.literal('basic'), username: z.string(), password: z.string() }),
  z.looseObject({ type: z.literal('api-key'), name: z.string(), value: z.string(), location: z.enum(['header', 'query']) }),
])

const responseSchema = z.looseObject({
  id: z.string(),
  statusCode: z.string(),
  description: z.string(),
  content: z.array(z.looseObject({ id: z.string(), mediaType: z.string(), schema: z.string(), example: z.string() })),
})

const requestNodeSchema = z.looseObject({
  id: z.string(),
  kind: z.literal('request'),
  name: z.string(),
  method: z.string(),
  url: z.string(),
  body: z.string(),
  bodyMode: z.optional(z.string()),
  bodyVariables: z.optional(z.string()),
  bodyMimeType: z.optional(z.string()),
  bodyFields: z.optional(
    z.array(
      z.looseObject({
        id: z.string(),
        name: z.string(),
        value: z.string(),
        enabled: z.boolean(),
        type: z.enum(['text', 'file']),
        fileName: z.optional(z.string()),
      }),
    ),
  ),
  headers: z.optional(z.array(keyValueRowSchema)),
  params: z.optional(z.array(keyValueRowSchema)),
  pathParams: z.optional(z.array(keyValueRowSchema)),
  auth: z.optional(authSchema),
  documentation: z.optional(z.string()),
  responses: z.optional(z.array(responseSchema)),
  deprecated: z.optional(z.boolean()),
  deprecationReason: z.optional(z.string()),
})

// Every node of the snapshot tree is checked, so a malformed desktop snapshot fails here and not inside a view.
export const apiNodeSchema: z.ZodMiniType<ApiNode, unknown> = z.union([
  requestNodeSchema,
  z.looseObject({
    id: z.string(),
    kind: z.literal('folder'),
    name: z.string(),
    children: z.array(z.lazy(() => apiNodeSchema)),
  }),
])

export const cloudCommitSchema = z.object({
  id: z.string(),
  parentIds: z.array(z.string()),
  message: z.string(),
  createdAt: z.string(),
  authorEmail: z.string(),
})

export const cloudMemberSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: workspaceRoleSchema,
  joinedAt: z.string(),
})

export const cloudInviteSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['editor', 'viewer']),
  expiresAt: z.string(),
  createdAt: z.string(),
  createdByEmail: z.string(),
})

export type CloudCommit = z.infer<typeof cloudCommitSchema>
export type CloudMember = z.infer<typeof cloudMemberSchema>
export type CloudInvite = z.infer<typeof cloudInviteSchema>
