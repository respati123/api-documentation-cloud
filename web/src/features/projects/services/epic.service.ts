import * as z from 'zod/mini'
import { epicCriteriaSchema, epicDocumentSchema, epicDocumentsSchema, epicTicketsSchema } from '@/features/projects/models/epic.model'
import { workspaceCall } from '@/features/projects/services/workspace-transport'

// CLOUD-001: the epic's documents, acceptance criteria and tickets. Every call is project-scoped.
const at = (projectId: string, epicRef: string, path: string) => `/projects/${projectId}/issues/${encodeURIComponent(epicRef)}${path}`

export const epicService = {
  documents: async (token: string, workspaceId: string, projectId: string, epicRef: string) =>
    z.parse(epicDocumentsSchema, await workspaceCall(workspaceId, at(projectId, epicRef, '/documents'), { token })),

  // Only a person approves: the PM the spec, the tech lead the design and the contract. The server checks the gates.
  approveDocument: async (token: string, workspaceId: string, projectId: string, epicRef: string, documentId: string) =>
    z.parse(
      z.object({ document: epicDocumentSchema }),
      await workspaceCall(workspaceId, at(projectId, epicRef, `/documents/${documentId}/approve`), { token, method: 'POST' }),
    ).document,

  criteria: async (token: string, workspaceId: string, projectId: string, epicRef: string) =>
    z.parse(epicCriteriaSchema, await workspaceCall(workspaceId, at(projectId, epicRef, '/acceptance-criteria'), { token })),

  // Every ticket of the epic with readiness and dependencies, and the open load of each member.
  tickets: async (token: string, workspaceId: string, projectId: string, epicRef: string) =>
    z.parse(epicTicketsSchema, await workspaceCall(workspaceId, at(projectId, epicRef, '/tickets'), { token })),
}
