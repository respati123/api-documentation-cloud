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
import type { Page } from '@/shared/models/page.model'
import { workspaceRoleSchema } from '@/shared/models/workspace.model'
import { apiCall, apiPage } from '@/shared/services/api-client'
import { pageQuery } from '@/shared/utils/page-query'

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
  pull: async (token: string, workspaceId: string): Promise<WorkspaceSnapshot | null> => {
    const result = z.parse(pullResponseSchema, await apiCall(`/api/workspaces/${workspaceId}/sync/pull`, { token }))
    return result.workspace as WorkspaceSnapshot | null
  },

  historyPage: async (token: string, workspaceId: string, cursor: string | null): Promise<Page<CloudCommit>> => {
    const page = await apiPage(`/api/workspaces/${workspaceId}/sync/history${pageQuery(cursor)}`, { token })
    return { items: z.parse(historyResponseSchema, page.data).commits, nextCursor: page.nextCursor }
  },

  commitTree: async (token: string, workspaceId: string, commitId: string): Promise<ApiNode[]> =>
    z.parse(commitResponseSchema, await apiCall(`/api/workspaces/${workspaceId}/sync/history/${commitId}`, { token })).commit
      .tree as ApiNode[],

  membersPage: async (token: string, workspaceId: string, cursor: string | null): Promise<Page<CloudMember>> => {
    const page = await apiPage(`/api/workspaces/${workspaceId}/members${pageQuery(cursor)}`, { token })
    return { items: z.parse(membersResponseSchema, page.data).members, nextCursor: page.nextCursor }
  },

  invitesPage: async (token: string, workspaceId: string, cursor: string | null): Promise<Page<CloudInvite>> => {
    const page = await apiPage(`/api/workspaces/${workspaceId}/invites${pageQuery(cursor)}`, { token })
    return { items: z.parse(invitesResponseSchema, page.data).invites, nextCursor: page.nextCursor }
  },

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
