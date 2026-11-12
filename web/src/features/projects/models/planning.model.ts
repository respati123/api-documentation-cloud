import * as z from 'zod/mini'
import { STORY_STAGES } from '@/features/projects/models/story.model'

export const DOCUMENT_STATUSES = ['draft', 'review_pm', 'review_team', 'approved', 'superseded'] as const
export const PLANNING_STATUSES = ['draft', 'refinement', 'ready', 'in_progress', 'review', 'done'] as const

export const documentStatusSchema = z.enum(DOCUMENT_STATUSES)
export const planningStatusSchema = z.enum(PLANNING_STATUSES)

export const documentSummarySchema = z.object({
  id: z.string(),
  kind: z.enum(['brd', 'prd']),
  title: z.string(),
  status: documentStatusSchema,
  currentVersion: z.number(),
  sourceDocumentId: z.nullable(z.string()),
  sourceOutdated: z.nullable(z.boolean()),
  approvedAt: z.optional(z.nullable(z.string())),
  updatedAt: z.string(),
})
export const documentListSchema = z.object({
  documents: z.array(documentSummarySchema),
  canManage: z.boolean(),
  canApprove: z.optional(z.boolean()),
})

export const documentSchema = z.extend(documentSummarySchema, {
  content: z.string(),
  fileName: z.nullable(z.string()),
  mimeType: z.nullable(z.string()),
  sourceVersion: z.nullable(z.number()),
  approvedBy: z.optional(z.nullable(z.string())),
  createdAt: z.optional(z.string()),
  versions: z.array(z.object({ version: z.number(), fileName: z.nullable(z.string()), createdAt: z.string() })),
})
export const documentVersionSchema = z.object({ version: z.number(), content: z.string(), createdAt: z.string() })

export const planningItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['epic', 'story']),
  parentId: z.nullable(z.string()),
  title: z.string(),
  description: z.string(),
  acceptanceCriteria: z.string(),
  status: planningStatusSchema,
  publishedAt: z.nullable(z.string()),
  sourceDocumentId: z.nullable(z.string()),
  sourceVersion: z.nullable(z.number()),
  sourceOutdated: z.nullable(z.boolean()),
  sourceSection: z.nullable(z.string()),
  participantIds: z.array(z.string()),
  createdAt: z.optional(z.string()),
  // Stories only: the design-first stage the server reads from status and design approval.
  stage: z.optional(z.enum(STORY_STAGES)),
})
export const planningTaskSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  priority: z.string(),
  assigneeId: z.nullable(z.string()),
  publishedAt: z.nullable(z.string()),
})
export const planningItemsSchema = z.object({ items: z.array(planningItemSchema), tasks: z.array(planningTaskSchema) })

export const planningCommentSchema = z.object({
  id: z.string(),
  parentId: z.nullable(z.string()),
  body: z.string(),
  isDecision: z.boolean(),
  resolvedAt: z.nullable(z.string()),
  createdBy: z.string(),
  authorEmail: z.string(),
  createdAt: z.string(),
})
export const planningEventSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  apiKeyId: z.nullable(z.string()),
  targetKind: z.string(),
  targetId: z.string(),
  action: z.string(),
  createdAt: z.string(),
})

export const planningChangedSchema = z.object({
  type: z.literal('planning.changed'),
  workspaceId: z.string(),
  scope: z.enum(['documents', 'items', 'comments', 'tasks', 'members']),
  actorId: z.string(),
})

export type DocumentStatus = z.infer<typeof documentStatusSchema>
export type PlanningStatus = z.infer<typeof planningStatusSchema>
export type PlanningDocumentSummary = z.infer<typeof documentSummarySchema>
export type PlanningDocument = z.infer<typeof documentSchema>
export type PlanningItem = z.infer<typeof planningItemSchema>
export type PlanningTask = z.infer<typeof planningTaskSchema>
export type PlanningComment = z.infer<typeof planningCommentSchema>
export type PlanningEvent = z.infer<typeof planningEventSchema>
export type TargetKind = 'document' | 'epic' | 'story' | 'task'
export type DocumentKind = PlanningDocumentSummary['kind']
