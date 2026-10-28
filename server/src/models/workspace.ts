export type Role = 'owner' | 'editor' | 'viewer'
export type BodyMode = 'form-data' | 'urlencoded' | 'graphql' | 'json' | 'xml' | 'yaml' | 'edn' | 'text' | 'other' | 'file' | 'none'
export type BodyField = { id: string; name: string; value: string; enabled: boolean; type: 'text' | 'file'; filePath?: string; fileName?: string }
export type HeaderField = { id: string; name: string; value: string; enabled: boolean; description?: string }
export type ParamField = { id: string; name: string; value: string; enabled: boolean; description?: string }
export type RequestAuth = { type: 'none' } | { type: 'bearer'; token: string } | { type: 'basic'; username: string; password: string } | { type: 'api-key'; name: string; value: string; location: 'header' | 'query' }
export type WorkspaceVariable = { id: string; name: string; value: string; secret: boolean }
export type WorkspaceEnvironment = { id: string; name: string; variables: WorkspaceVariable[] }
export type WorkspaceVariables = { globals: WorkspaceVariable[]; environments: WorkspaceEnvironment[] }
export type TreeNode =
  | { id: string; kind: 'folder'; name: string; children: TreeNode[] }
  | { id: string; kind: 'request'; name: string; method: string; url: string; body: string; bodyMode?: BodyMode; bodyFields?: BodyField[]; bodyVariables?: string; bodyMimeType?: string; bodyPath?: string; bodyFileName?: string; headers?: HeaderField[]; params?: ParamField[]; auth?: RequestAuth; documentation?: string; deprecated?: boolean; deprecationReason?: string }
export type AuthUser = { id: string; email: string }
export type SyncSocketData = { userId: string }
export type SyncSocketTicket = { userId: string; expiresAt: number }
export type WorkspaceChangeReason = 'members' | 'invites' | 'settings' | 'deleted'
