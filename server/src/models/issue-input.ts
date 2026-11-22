import * as z from 'zod'
import { ISSUE_TYPES } from '@/models/issue'

// These schemas check the shape and the size of a request. The rules of the domain, such as which points are allowed,
// stay in the services. Unknown keys are refused, so a typo in a client fails loudly.
const id = z.string().min(1).max(100)
const nullableId = id.nullable().optional()

export const createIssueBody = z.strictObject({
  type: z.enum(ISSUE_TYPES),
  title: z.string().max(1000),
  description: z.string().max(20_000).optional(),
  acceptanceCriteria: z.string().max(20_000).optional(),
  parentId: nullableId,
  points: z.number().int().nullable().optional(),
  priority: z.string().max(20).optional(),
  role: z.string().max(20).nullable().optional(),
  assigneeId: nullableId,
  dueDate: z.string().max(10).nullable().optional(),
  sourceDocumentId: nullableId,
  sourceVersion: z.number().int().min(1).nullable().optional(),
  sourceSection: z.string().max(300).nullable().optional(),
  featurePrefix: z.string().max(20).nullable().optional(),
})

export const updateIssueBody = z.strictObject({
  title: z.string().max(1000).optional(),
  description: z.string().max(20_000).optional(),
  acceptanceCriteria: z.string().max(20_000).optional(),
  status: z.string().max(30).optional(),
  points: z.number().int().nullable().optional(),
  priority: z.string().max(20).optional(),
  parentId: nullableId,
  assigneeId: nullableId,
  dueDate: z.string().max(10).nullable().optional(),
  featurePrefix: z.string().max(20).optional(),
})

// The spec, design and contract of an epic. The service checks which sections each kind needs.
const sections = z.record(z.string().max(60), z.string().max(30_000))
export const epicDocumentBody = z.strictObject({ kind: z.enum(['spec', 'design', 'contract']), title: z.string().max(1000).optional(), sections })
export const epicDocumentReviseBody = z.strictObject({ expectedVersion: z.number().int().min(1), title: z.string().max(1000).optional(), sections })

export const rankBody = z.strictObject({ afterId: nullableId, beforeId: nullableId })
export const checklistAddBody = z.strictObject({ title: z.string().max(1000) })
export const checklistDoneBody = z.strictObject({ done: z.boolean() })
export const linkAddBody = z.strictObject({ toId: id, kind: z.enum(['blocks', 'relates', 'found_in']) })

export const sprintBody = z.strictObject({
  name: z.string().max(1000),
  goal: z.string().max(5000).optional(),
  startsOn: z.string().max(10),
  endsOn: z.string().max(10),
})
export const sprintPatchBody = z.strictObject({
  name: z.string().max(1000).optional(),
  goal: z.string().max(5000).optional(),
  startsOn: z.string().max(10).optional(),
  endsOn: z.string().max(10).optional(),
})
export const sprintItemBody = z.strictObject({ issueId: id, overrideReason: z.string().max(2000).optional() })
export const sprintCloseBody = z.strictObject({ carryTo: id })

export const projectSettingsBody = z.strictObject({
  key: z.string().max(20).optional(),
  mode: z.enum(['scrum', 'kanban']).optional(),
  productGoal: z.string().max(10_000).optional(),
})

export const issueListQuery = z.strictObject({
  type: z.enum(ISSUE_TYPES).optional(),
  sprint: id.optional(),
  epic: id.optional(),
})

const outlineStory = z.strictObject({
  title: z.string().max(1000),
  description: z.string().max(20_000).optional(),
  acceptanceCriteria: z.string().max(20_000).optional(),
  points: z.number().int().nullable().optional(),
  sourceSection: z.string().max(300).nullable().optional(),
})
const outlineEpic = z.strictObject({
  title: z.string().max(1000),
  description: z.string().max(20_000).optional(),
  sourceSection: z.string().max(300).nullable().optional(),
  stories: z.array(outlineStory).max(200).optional(),
})
export const draftBacklogBody = z.strictObject({ epics: z.array(outlineEpic).max(50).optional() })
