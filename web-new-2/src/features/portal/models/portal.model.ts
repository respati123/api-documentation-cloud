export type WorkspaceRole = 'owner' | 'editor' | 'viewer'
export type MemberRole = Exclude<WorkspaceRole, 'owner'>
export type McpKeyStatus = 'active' | 'expired' | 'revoked'
export type McpKeyValidDays = 30 | 90 | 365 | null
export type WorkspaceSection =
  | 'overview'
  | 'collections'
  | 'history'
  | 'design-ui'
  | 'design-database'
  | 'projects'
  | 'team'
  | 'settings'
  | 'mcp-key'
  | 'admin-mcp-keys'
  | 'admin-users'
  | 'admin-workspaces'

export interface User {
  id: string
  email: string
  isAdmin?: boolean
}

export type NotificationKind =
  | 'mcp_key_ready'
  | 'comment_mention'
  | 'comment_reply'
  | 'task_comment'
  | 'task_assigned'
  | 'design_approved'

export interface AppNotification {
  id: string
  kind: NotificationKind
  link: string
  data: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export interface NotificationInbox {
  notifications: AppNotification[]
  unreadCount: number
}

export interface Workspace {
  id: string
  name: string
  role: WorkspaceRole
  updatedAt: string | null
  createdAt: string
}

export interface KeyValueRow {
  id: string
  name: string
  value: string
  enabled: boolean
  description?: string
}

export interface RequestBodyField {
  id: string
  name: string
  value: string
  enabled: boolean
  type: 'text' | 'file'
  fileName?: string
}

export type RequestAuth =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'api-key'; name: string; value: string; location: 'header' | 'query' }

export interface ResponseContent {
  id: string
  mediaType: string
  schema: string
  example: string
}

export interface ResponseExample {
  id: string
  statusCode: string
  description: string
  content: ResponseContent[]
}

export interface ApiNode {
  id: string
  name: string
  kind: 'folder' | 'request'
  children?: ApiNode[]
  method?: string
  url?: string
  body?: string
  bodyMode?: string
  bodyFields?: RequestBodyField[]
  bodyVariables?: string
  bodyMimeType?: string
  headers?: KeyValueRow[]
  params?: KeyValueRow[]
  pathParams?: KeyValueRow[]
  auth?: RequestAuth
  documentation?: string
  responses?: ResponseExample[]
  deprecated?: boolean
  deprecationReason?: string
}

export interface Snapshot extends Workspace {
  tree: ApiNode[]
  // True when an app admin who is not a member reads the workspace. Such a reader can only view it.
  adminView?: boolean
  usesBranches?: boolean
  branches?: CollectionBranch[]
}

export interface CollectionBranch {
  id: string
  collectionKey: string
  name: string
  headCommitId: string | null
}

export interface Member {
  id: string
  email: string
  role: WorkspaceRole
  joinedAt: string
}

export interface MemberOption {
  id: string
  email: string
}

export interface WorkspaceInvite {
  id: string
  email: string
  role: MemberRole
  expiresAt: string
  createdAt: string
  createdByEmail: string
  createdByName: string | null
}

export interface Commit {
  id: string
  message: string
  authorEmail: string
  createdAt: string
  parentIds?: string[]
}

export interface McpKey {
  id: string
  name: string
  keySuffix: string | null
  status: McpKeyStatus
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export interface AdminMcpKey extends McpKey {
  owner: { id: string; email: string }
}

export interface McpWorkspaceAccess {
  id: string
  name: string
  roles: string[]
  tools: string[]
}

export interface McpGuide {
  roles: string[]
  version: string
  guide: string
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

// Admin users. Roles are role ids on accounts; the role master gives each id its name.
export interface AdminUser {
  id: string
  email: string
  name: string | null
  isAdmin: boolean
  roles: string[]
  createdAt: string
}

export interface RoleMaster {
  id: string
  name: string
}

export interface UserInvite {
  id: string
  email: string
  expiresAt: string
  createdAt: string
  createdByEmail: string
}

export interface UserInviteResult {
  id: string
  email: string
  token: string
  inviteUrl: string
  expiresInDays: number
  emailSent: boolean
}

export interface AdminWorkspace {
  id: string
  name: string
  ownerEmail: string
  memberCount: number
  createdAt: string
}
