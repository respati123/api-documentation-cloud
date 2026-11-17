import * as z from 'zod/mini'

export const ISSUE_TYPES = ['epic', 'story', 'task', 'bug', 'subtask'] as const
export const STORY_STATUSES = ['draft', 'in_design', 'ready', 'in_progress', 'in_qa', 'done'] as const
export const WORK_STATUSES = ['todo', 'in_progress', 'in_review', 'done'] as const
export const POINT_VALUES = [1, 2, 3, 5, 8, 13] as const
export const ISSUE_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export const SPRINT_STATUSES = ['planned', 'active', 'closed'] as const
export const LINK_KINDS = ['blocks', 'relates', 'found_in'] as const

export type IssueType = (typeof ISSUE_TYPES)[number]
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number]
export type SprintStatus = (typeof SPRINT_STATUSES)[number]
export type LinkKind = (typeof LINK_KINDS)[number]
export type StatusCategory = 'todo' | 'in_progress' | 'done'

// The category groups every status into the three board columns. It must match models/issue.ts on the server.
const CATEGORY: Record<string, StatusCategory> = {
  draft: 'todo',
  in_design: 'todo',
  ready: 'todo',
  todo: 'todo',
  in_progress: 'in_progress',
  in_qa: 'in_progress',
  in_review: 'in_progress',
  done: 'done',
}

// A status the server sends that this page does not know is shown in the first column instead of breaking the screen.
export function statusCategory(status: string | null): StatusCategory {
  return (status && CATEGORY[status]) || 'todo'
}

export const isBacklogItem = (type: IssueType) => type === 'story' || type === 'task' || type === 'bug'

export const issueSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  number: z.number(),
  key: z.string(),
  type: z.enum(ISSUE_TYPES),
  parentId: z.nullable(z.string()),
  title: z.string(),
  description: z.string(),
  acceptanceCriteria: z.string(),
  userStoryRole: z.string(),
  userStoryAction: z.string(),
  userStoryBenefit: z.string(),
  flow: z.string(),
  status: z.nullable(z.string()),
  points: z.nullable(z.number()),
  priority: z.enum(ISSUE_PRIORITIES),
  rank: z.nullable(z.number()),
  sprintId: z.nullable(z.string()),
  role: z.nullable(z.string()),
  assigneeId: z.nullable(z.string()),
  assigneeEmail: z.nullable(z.string()),
  dueDate: z.nullable(z.string()),
  sourceDocumentId: z.nullable(z.string()),
  sourceVersion: z.nullable(z.number()),
  sourceSection: z.nullable(z.string()),
  sourceReviewedVersion: z.nullable(z.number()),
  sourceOutdated: z.nullable(z.boolean()),
  designApprovedBy: z.nullable(z.string()),
  designApprovedAt: z.nullable(z.string()),
  testCaseId: z.nullable(z.string()),
  publishedAt: z.nullable(z.string()),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const sprintSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  goal: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
  status: z.enum(SPRINT_STATUSES),
  startedAt: z.nullable(z.string()),
  closedAt: z.nullable(z.string()),
  createdBy: z.string(),
  createdAt: z.string(),
})

export const sprintWithIssuesSchema = z.extend(sprintSchema, { issues: z.array(issueSchema) })

export const backlogSchema = z.object({
  sprints: z.array(sprintWithIssuesSchema),
  backlog: z.object({ items: z.array(issueSchema), nextCursor: z.nullable(z.string()) }),
})

export const checklistItemSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  title: z.string(),
  done: z.boolean(),
  position: z.number(),
})

export const issueLinkSchema = z.object({
  id: z.string(),
  kind: z.enum(LINK_KINDS),
  direction: z.enum(['out', 'in']),
  issueId: z.string(),
  issueKey: z.string(),
  issueTitle: z.string(),
})

export const projectSettingsSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  mode: z.enum(['scrum', 'kanban']),
  productGoal: z.string(),
})

export type Issue = z.infer<typeof issueSchema>
export type Sprint = z.infer<typeof sprintSchema>
export type SprintWithIssues = z.infer<typeof sprintWithIssuesSchema>
export type Backlog = z.infer<typeof backlogSchema>
export type ChecklistItem = z.infer<typeof checklistItemSchema>
export type IssueLink = z.infer<typeof issueLinkSchema>
export type ProjectSettings = z.infer<typeof projectSettingsSchema>
