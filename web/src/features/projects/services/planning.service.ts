import * as z from 'zod/mini'
import {
  type DocumentKind,
  type DocumentStatus,
  documentListSchema,
  documentSchema,
  documentVersionSchema,
  type PlanningStatus,
  planningCommentSchema,
  planningEventSchema,
  planningItemsSchema,
  type TargetKind,
} from '@/features/projects/models/planning.model'
import { storyDetailsSchema } from '@/features/projects/models/story.model'
import { workspaceCall } from '@/features/projects/services/workspace-transport'
import { apiBlob } from '@/shared/services/api-client'

export interface NewItemInput {
  kind: 'epic' | 'story'
  parentId?: string
  title: string
  description: string
  acceptanceCriteria: string
  sourceDocumentId: string
  sourceSection?: string
  participantIds: string[]
}

export const planningService = {
  documents: async (token: string, workspaceId: string) =>
    z.parse(documentListSchema, await workspaceCall(workspaceId, `/planning/documents`, { token })),
  document: async (token: string, workspaceId: string, id: string) =>
    z.parse(z.object({ document: documentSchema }), await workspaceCall(workspaceId, `/planning/documents/${id}`, { token })).document,
  documentVersion: async (token: string, workspaceId: string, id: string, version: number) =>
    z.parse(
      z.object({ version: documentVersionSchema }),
      await workspaceCall(workspaceId, `/planning/documents/${id}/versions/${version}`, { token }),
    ).version,
  download: (token: string, workspaceId: string, id: string) =>
    apiBlob(`/api/workspaces/${workspaceId}/planning/documents/${id}/file`, token),
  createDocument: (
    token: string,
    workspaceId: string,
    input: { kind: DocumentKind; title: string; content: string; sourceDocumentId?: string },
  ) => workspaceCall(workspaceId, `/planning/documents`, { token, method: 'POST', body: input }),
  upload: (token: string, workspaceId: string, input: { kind: DocumentKind; title: string; sourceDocumentId?: string; file: File }) => {
    const form = new FormData()
    form.set('kind', input.kind)
    form.set('title', input.title)
    if (input.sourceDocumentId) form.set('sourceDocumentId', input.sourceDocumentId)
    form.set('file', input.file)
    return workspaceCall(workspaceId, `/planning/documents/upload`, { token, method: 'POST', body: form })
  },
  reviseDocument: (token: string, workspaceId: string, id: string, content: string, expectedVersion: number) =>
    workspaceCall(workspaceId, `/planning/documents/${id}`, { token, method: 'PATCH', body: { content, expectedVersion } }),
  documentStatus: (token: string, workspaceId: string, id: string, status: DocumentStatus) =>
    workspaceCall(workspaceId, `/planning/documents/${id}/status`, { token, method: 'POST', body: { status } }),
  items: async (token: string, workspaceId: string) =>
    z.parse(planningItemsSchema, await workspaceCall(workspaceId, `/planning/items`, { token })),
  createItem: (token: string, workspaceId: string, input: NewItemInput) =>
    workspaceCall(workspaceId, `/planning/items`, { token, method: 'POST', body: input }),
  updateItem: (
    token: string,
    workspaceId: string,
    id: string,
    input: { title?: string; description?: string; acceptanceCriteria?: string; status?: PlanningStatus; participantIds?: string[] },
  ) => workspaceCall(workspaceId, `/planning/items/${id}`, { token, method: 'PATCH', body: input }),
  publishEpic: (token: string, workspaceId: string, id: string) =>
    workspaceCall(workspaceId, `/planning/items/${id}/publish`, { token, method: 'POST' }),
  rebaseEpic: (token: string, workspaceId: string, id: string) =>
    workspaceCall(workspaceId, `/planning/items/${id}/rebase`, { token, method: 'POST' }),
  createTaskDraft: (
    token: string,
    workspaceId: string,
    input: { storyId: string; title: string; description: string; assigneeId: string | null },
  ) => workspaceCall(workspaceId, `/planning/task-drafts`, { token, method: 'POST', body: input }),
  updateTaskDraft: (token: string, workspaceId: string, id: string, input: { title: string; assigneeId: string | null }) =>
    workspaceCall(workspaceId, `/planning/task-drafts/${id}`, { token, method: 'PATCH', body: input }),
  comments: async (token: string, workspaceId: string, targetKind: TargetKind, targetId: string) =>
    z.parse(
      z.object({ comments: z.array(planningCommentSchema) }),
      await workspaceCall(workspaceId, `/planning/${targetKind}/${targetId}/comments`, { token }),
    ).comments,
  comment: (
    token: string,
    workspaceId: string,
    targetKind: TargetKind,
    targetId: string,
    body: string,
    isDecision = false,
    parentId?: string,
    mentionIds: string[] = [],
  ) =>
    workspaceCall(workspaceId, `/planning/${targetKind}/${targetId}/comments`, {
      token,
      method: 'POST',
      body: { body, isDecision, parentId, mentionIds },
    }),
  resolveComment: (token: string, workspaceId: string, id: string) =>
    workspaceCall(workspaceId, `/planning/comments/${id}/resolve`, { token, method: 'POST' }),
  events: async (token: string, workspaceId: string) =>
    z.parse(z.object({ events: z.array(planningEventSchema) }), await workspaceCall(workspaceId, `/planning/events`, { token })).events,
  story: async (token: string, workspaceId: string, storyId: string) =>
    z.parse(z.object({ story: storyDetailsSchema }), await workspaceCall(workspaceId, `/planning/stories/${storyId}`, { token })).story,
  updateStory: (
    token: string,
    workspaceId: string,
    storyId: string,
    input: {
      userStory: { role: string; action: string; benefit: string }
      flow: string
      definitionOfDone: Array<{ id?: string; text: string; role: string }>
    },
  ) => workspaceCall(workspaceId, `/planning/stories/${storyId}`, { token, method: 'PATCH', body: input }),
  approveDesign: (token: string, workspaceId: string, storyId: string) =>
    workspaceCall(workspaceId, `/planning/stories/${storyId}/approve-design`, { token, method: 'POST' }),
  setDodItem: (token: string, workspaceId: string, storyId: string, itemId: string, done: boolean) =>
    workspaceCall(workspaceId, `/planning/stories/${storyId}/dod/${itemId}`, { token, method: 'PATCH', body: { done } }),
}
