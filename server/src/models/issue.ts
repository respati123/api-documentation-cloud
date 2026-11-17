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
