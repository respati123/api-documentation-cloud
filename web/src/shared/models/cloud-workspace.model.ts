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
