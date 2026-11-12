export const WORK_ROLES = ['ui_ux', 'backend', 'frontend', 'mobile', 'qa'] as const
export type WorkRole = (typeof WORK_ROLES)[number]

export const STORY_STAGES = ['draft', 'design', 'design_approved', 'in_progress', 'qa', 'done'] as const
export type StoryStage = (typeof STORY_STAGES)[number]

// The design-first stage of a story, read from its status and design approval. Status values stay as they are,
// so existing stories and the publish rules keep working.
export function storyStage(status: string, designApprovedAt: Date | string | null, designCount: number): StoryStage {
  if (status === 'done') return 'done'
  if (status === 'review') return 'qa'
  if (status === 'in_progress') return 'in_progress'
  if (designApprovedAt) return 'design_approved'
  if (status === 'refinement' || status === 'ready' || designCount > 0) return 'design'
  return 'draft'
}

export function isWorkRole(value: unknown): value is WorkRole {
  return typeof value === 'string' && (WORK_ROLES as readonly string[]).includes(value)
}

export interface CollectionRequest {
  id: string
  method: string
  url: string
  name: string
}
