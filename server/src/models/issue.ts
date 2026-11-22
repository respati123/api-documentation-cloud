export const ISSUE_TYPES = ['epic', 'story', 'task', 'bug', 'subtask'] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

export const STORY_STATUSES = ['draft', 'in_design', 'ready', 'in_progress', 'in_qa', 'done'] as const
export const WORK_STATUSES = ['todo', 'in_progress', 'in_review', 'done'] as const
export type StoryStatus = (typeof STORY_STATUSES)[number]
export type WorkStatus = (typeof WORK_STATUSES)[number]
export type IssueStatus = StoryStatus | WorkStatus

export type StatusCategory = 'todo' | 'in_progress' | 'done'

const CATEGORY: Record<IssueStatus, StatusCategory> = {
  draft: 'todo',
  in_design: 'todo',
  ready: 'todo',
  todo: 'todo',
  in_progress: 'in_progress',
  in_qa: 'in_progress',
  in_review: 'in_progress',
  done: 'done',
}

export const POINT_VALUES = [1, 2, 3, 5, 8, 13] as const
export type Points = (typeof POINT_VALUES)[number]

export function statusCategory(status: string): StatusCategory {
  const category = CATEGORY[status as IssueStatus]
  if (!category) throw new Error(`Unknown issue status: ${status}`)
  return category
}

// Epics store no status, so they have no list.
export function allowedStatuses(type: IssueType): readonly IssueStatus[] {
  if (type === 'epic') return []
  return type === 'story' ? STORY_STATUSES : WORK_STATUSES
}

// An epic is computed from its children: done when all are done, in progress when any has started, otherwise todo.
export function epicStatus(childStatuses: readonly string[]): StatusCategory {
  if (childStatuses.length === 0) return 'todo'
  const categories = childStatuses.map(statusCategory)
  if (categories.every((category) => category === 'done')) return 'done'
  return categories.some((category) => category !== 'todo') ? 'in_progress' : 'todo'
}

export function isPoints(value: unknown): value is Points {
  return typeof value === 'number' && (POINT_VALUES as readonly number[]).includes(value)
}

// Story, task and bug are ranked in the backlog and can enter a sprint.
export function isBacklogItem(type: IssueType): boolean {
  return type === 'story' || type === 'task' || type === 'bug'
}

// Backlog order. Items are spaced a step apart, so one can be dropped between two others without moving the rest.
export const RANK_STEP = 1024

// The rank for an item placed after `before` and ahead of `after`. Null means there is no whole number left in that
// gap, and the caller renumbers the backlog first.
export function rankBetween(before: number | null, after: number | null): number | null {
  if (before === null && after === null) return RANK_STEP
  if (after === null) return (before as number) + RANK_STEP
  const middle = before === null ? Math.floor(after / 2) : Math.floor((before + after) / 2)
  const floor = before ?? 0
  return middle > floor && middle < after ? middle : null
}

export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent'
export const ISSUE_PRIORITIES: readonly IssuePriority[] = ['low', 'medium', 'high', 'urgent']

export interface IssueRow {
  id: string
  projectId: string
  number: number
  // Project key and number, such as PARI-12.
  key: string
  type: IssueType
  parentId: string | null
  title: string
  description: string
  acceptanceCriteria: string
  userStoryRole: string
  userStoryAction: string
  userStoryBenefit: string
  flow: string
  status: IssueStatus | null
  points: Points | null
  priority: IssuePriority
  rank: number | null
  sprintId: string | null
  role: string | null
  assigneeId: string | null
  assigneeEmail: string | null
  dueDate: string | null
  sourceDocumentId: string | null
  sourceVersion: number | null
  sourceSection: string | null
  sourceReviewedVersion: number | null
  // True when a newer version of the source document exists that the PM has not reviewed. Null without a source.
  sourceOutdated: boolean | null
  designApprovedBy: string | null
  designApprovedAt: Date | null
  testCaseId: string | null
  // Epics only: the feature code, such as AUTH-001, and its two parts. Null for every other type.
  featurePrefix: string | null
  featureNumber: number | null
  featureCode: string | null
  // Tasks with ticket details: the ticket code, such as AUTH-001-BE-2, and the size S, M or L.
  ticketCode: string | null
  size: 'S' | 'M' | 'L' | null
  // True once the tech lead has written ticket fields for the task. Only then does the Definition of Ready apply.
  isTicket: boolean
  publishedAt: Date | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
