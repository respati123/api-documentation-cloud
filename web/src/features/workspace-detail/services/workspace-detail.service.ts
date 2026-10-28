import * as z from 'zod/mini'
import {
  type ApiNode,
  type CloudCommit,
  type CloudInvite,
  type CloudMember,
  cloudCommitSchema,
  cloudInviteSchema,
  cloudMemberSchema,
  type WorkspaceSnapshot,
} from '@/shared/models/cloud-workspace.model'
import { workspaceRoleSchema } from '@/shared/models/workspace.model'
import { apiCall } from '@/shared/services/api-client'

const snapshotSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  role: workspaceRoleSchema,
  headCommitId: z.nullable(z.string()),
  createdAt: z.string(),
  updatedAt: z.optional(z.nullable(z.string())),
  tree: z.array(z.looseObject({ id: z.string(), kind: z.enum(['request', 'folder']), name: z.string() })),
})

const pullResponseSchema = z.object({ workspace: z.nullable(snapshotSchema) })
const historyResponseSchema = z.object({ commits: z.array(cloudCommitSchema) })
const commitResponseSchema = z.object({
  commit: z.object({ tree: z.array(z.looseObject({ id: z.string(), kind: z.enum(['request', 'folder']), name: z.string() })) }),
})
const membersResponseSchema = z.object({ members: z.array(cloudMemberSchema) })
const invitesResponseSchema = z.object({ invites: z.array(cloudInviteSchema) })
const createInviteResponseSchema = z.object({ token: z.string(), email: z.string(), emailSent: z.boolean() })
const renameResponseSchema = z.object({ workspace: z.object({ id: z.string(), name: z.string() }) })

// The snapshot tree is checked at the top level only. Request fields come from the desktop snapshot and are typed, not re-validated.
export type SnapshotResult = Omit<WorkspaceSnapshot, 'tree'> & { tree: ApiNode[] }

export const workspaceDetailService = {
  detail: async (token: string, workspaceId: string) => {
    const [snapshot, commits, members] = await Promise.all([
      workspaceDetailService.pull(token, workspaceId),
      workspaceDetailService.history(token, workspaceId),
      workspaceDetailService.members(token, workspaceId),
    ])
    return { snapshot, commits, members }
  },

  pull: async (token: string, workspaceId: string): Promise<WorkspaceSnapshot | null> => {
    const result = z.parse(pullResponseSchema, await apiCall(`/api/workspaces/${workspaceId}/sync/pull`, { token }))
    return result.workspace as WorkspaceSnapshot | null
  },

  history: async (token: string, workspaceId: string): Promise<CloudCommit[]> =>
    z.parse(historyResponseSchema, await apiCall(`/api/workspaces/${workspaceId}/sync/history`, { token })).commits,

  commitTree: async (token: string, workspaceId: string, commitId: string): Promise<ApiNode[]> =>
    z.parse(commitResponseSchema, await apiCall(`/api/workspaces/${workspaceId}/sync/history/${commitId}`, { token })).commit
      .tree as ApiNode[],

  members: async (token: string, workspaceId: string): Promise<CloudMember[]> =>
    z.parse(membersResponseSchema, await apiCall(`/api/workspaces/${workspaceId}/members`, { token })).members,

  invites: async (token: string, workspaceId: string): Promise<CloudInvite[]> =>
    z.parse(invitesResponseSchema, await apiCall(`/api/workspaces/${workspaceId}/invites`, { token })).invites,

  createInvite: async (token: string, workspaceId: string, email: string, role: 'editor' | 'viewer') =>
    z.parse(
      createInviteResponseSchema,
      await apiCall(`/api/workspaces/${workspaceId}/invites`, { token, method: 'POST', body: { email, role } }),
    ),

  cancelInvite: async (token: string, workspaceId: string, inviteId: string): Promise<void> => {
    await apiCall(`/api/workspaces/${workspaceId}/invites/${inviteId}`, { token, method: 'DELETE' })
  },

  changeMemberRole: async (token: string, workspaceId: string, memberId: string, role: 'editor' | 'viewer'): Promise<void> => {
    await apiCall(`/api/workspaces/${workspaceId}/members/${memberId}`, { token, method: 'PATCH', body: { role } })
  },

  removeMember: async (token: string, workspaceId: string, memberId: string): Promise<void> => {
    await apiCall(`/api/workspaces/${workspaceId}/members/${memberId}`, { token, method: 'DELETE' })
  },

  rename: async (token: string, workspaceId: string, name: string) =>
    z.parse(renameResponseSchema, await apiCall(`/api/workspaces/${workspaceId}`, { token, method: 'PATCH', body: { name } })).workspace,

  delete: async (token: string, workspaceId: string, confirmName: string): Promise<void> => {
    await apiCall(`/api/workspaces/${workspaceId}`, { token, method: 'DELETE', body: { confirmName } })
  },

  restoreCommit: async (token: string, workspaceId: string, commitId: string): Promise<void> => {
    await apiCall(`/api/workspaces/${workspaceId}/sync/restore/${commitId}`, { token, method: 'POST' })
  },

  acceptInvite: async (token: string, inviteToken: string): Promise<{ id: string; name: string }> => {
    const result = z.parse(
      renameResponseSchema,
      await apiCall('/api/invites/accept', { token, method: 'POST', body: { token: inviteToken } }),
    )
    return result.workspace
  },
}
