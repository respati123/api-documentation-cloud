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
  // CLOUD-001: the feature code of an epic (AUTH-001), and the ticket code (AUTH-001-BE-2) and size of a ticket.
  // Optional so an older server and the sample workspace still parse.
  featureCode: z.optional(z.nullable(z.string())),
  ticketCode: z.optional(z.nullable(z.string())),
  size: z.optional(z.nullable(z.enum(['S', 'M', 'L']))),
  isTicket: z.optional(z.boolean()),
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

export const reportItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  type: z.string(),
  status: z.nullable(z.string()),
  points: z.nullable(z.number()),
})

export const burndownSchema = z.object({
  sprintId: z.string(),
  total: z.number(),
  days: z.array(z.object({ date: z.string(), remaining: z.nullable(z.number()), ideal: z.number() })),
})

export const sprintReportSchema = z.object({
  sprint: sprintSchema,
  committedPoints: z.number(),
  completedPoints: z.number(),
  completed: z.array(reportItemSchema),
  notCompleted: z.array(reportItemSchema),
  addedAfterStart: z.array(reportItemSchema),
  removedAfterStart: z.array(reportItemSchema),
  pointsChanged: z.array(z.extend(reportItemSchema, { before: z.nullable(z.number()), after: z.nullable(z.number()) })),
})

export const velocitySchema = z.object({
  sprints: z.array(
    z.object({
      sprintId: z.string(),
      name: z.string(),
      startsOn: z.string(),
      endsOn: z.string(),
      committedPoints: z.number(),
      addedPoints: z.number(),
      completedPoints: z.number(),
    }),
  ),
  averageCompleted: z.number(),
})

const summarySchema = z.object({ count: z.number(), average: z.number(), median: z.number(), p85: z.number() })

export const flowSchema = z.object({
  days: z.number(),
  wip: z.object({
    total: z.number(),
    byStatus: z.array(z.object({ status: z.string(), count: z.number(), limit: z.nullable(z.number()), over: z.boolean() })),
  }),
  throughput: z.object({ perDay: z.array(z.object({ date: z.string(), done: z.number() })), total: z.number() }),
  cycleTime: summarySchema,
  workItemAge: z.object({
    average: z.number(),
    oldest: z.array(z.object({ id: z.string(), key: z.string(), title: z.string(), ageDays: z.number() })),
  }),
  cumulativeFlow: z.array(z.object({ date: z.string(), todo: z.number(), in_progress: z.number(), done: z.number() })),
})

export const wipLimitsSchema = z.object({ limits: z.array(z.object({ status: z.string(), limit: z.number() })) })

export type ReportItem = z.infer<typeof reportItemSchema>
export type Burndown = z.infer<typeof burndownSchema>
export type SprintReport = z.infer<typeof sprintReportSchema>
export type Velocity = z.infer<typeof velocitySchema>
export type FlowMetrics = z.infer<typeof flowSchema>
export type WipLimit = { status: string; limit: number }

// CLOUD-001: the ticket fields of a task and its Definition of Ready.
export const READINESS_ITEMS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

export const readinessSchema = z.object({
  ready: z.boolean(),
  failing: z.array(z.object({ item: z.number(), rule: z.string(), reason: z.string() })),
})

// The server writes Given / When / Then with a "then" list. A data object with a "then" key looks like a promise to
// await, so the list is read from the raw object and kept as "outcomes".
const outcomesOf = (raw: Record<string, unknown>) => z.parse(z.array(z.string()), raw.then)
const givenWhenThenSchema = z.pipe(
  z.looseObject({ given: z.string(), when: z.string() }),
  z.transform((raw) => ({ given: raw.given, when: raw.when, outcomes: outcomesOf(raw) })),
)

export const ticketDetailsSchema = z.object({
  repo: z.string(),
  goal: z.string(),
  scope: z.string(),
  designNotes: z.string(),
  codeFollow: z.string(),
  codeTouch: z.string(),
  ticketAcs: z.array(givenWhenThenSchema),
  requiredTests: z.array(z.object({ case: z.string(), unhappy: z.boolean() })),
  outOfScope: z.string(),
  skills: z.array(z.string()),
  size: z.nullable(z.enum(['S', 'M', 'L'])),
  usesApi: z.boolean(),
  openQuestions: z.string(),
})

export const ticketSchema = z.object({ issue: issueSchema, details: ticketDetailsSchema, readiness: readinessSchema })

export const deliveredCriterionSchema = z.pipe(
  z.looseObject({
    id: z.string(),
    number: z.number(),
    code: z.string(),
    ref: z.string(),
    flow: z.string(),
    title: z.string(),
    given: z.string(),
    when: z.string(),
    status: z.enum(['active', 'struck']),
    struckReason: z.nullable(z.string()),
  }),
  z.transform((raw) => ({
    id: raw.id,
    number: raw.number,
    code: raw.code,
    ref: raw.ref,
    flow: raw.flow,
    title: raw.title,
    given: raw.given,
    when: raw.when,
    outcomes: outcomesOf(raw),
    status: raw.status,
    struckReason: raw.struckReason,
  })),
)

export type Readiness = z.infer<typeof readinessSchema>
export type TicketDetails = z.output<typeof ticketDetailsSchema>
export type Ticket = z.output<typeof ticketSchema>
export type DeliveredCriterion = z.output<typeof deliveredCriterionSchema>

// The code people use for an issue: the ticket code of a ticket, the feature code of an epic, else the key.
export const displayCode = (issue: Pick<Issue, 'key' | 'ticketCode' | 'featureCode'>) => issue.ticketCode ?? issue.featureCode ?? issue.key

// The failing readiness items a refused sprint move carries, if any.
export function readinessFailures(details: unknown): Array<{ item: number; reason: string }> {
  if (!details || typeof details !== 'object') return []
  const failing = (details as { failing?: unknown }).failing
  if (!Array.isArray(failing)) return []
  return failing.flatMap((miss) =>
    miss &&
    typeof miss === 'object' &&
    typeof (miss as { item?: unknown }).item === 'number' &&
    typeof (miss as { reason?: unknown }).reason === 'string'
      ? [{ item: (miss as { item: number }).item, reason: (miss as { reason: string }).reason }]
      : [],
  )
}
