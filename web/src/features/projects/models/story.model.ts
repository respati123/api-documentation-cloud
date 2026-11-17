import * as z from 'zod/mini'

// The design-first story steps from plan 2.1. Older statuses still come from the server and are mapped by storyStage().
export const STORY_STAGES = ['draft', 'design', 'design_approved', 'in_progress', 'qa', 'done'] as const
export type StoryStage = (typeof STORY_STAGES)[number]

export const WORK_ROLES = ['ui_ux', 'backend', 'frontend', 'mobile', 'qa'] as const
export const workRoleSchema = z.enum(WORK_ROLES)
export type WorkRole = z.infer<typeof workRoleSchema>

export const dodItemSchema = z.object({ id: z.string(), text: z.string(), role: workRoleSchema, done: z.boolean() })
export const designSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  note: z.string(),
  createdBy: z.string(),
  viaKey: z.nullable(z.string()),
})
export const contractSchema = z.object({
  id: z.string(),
  method: z.string(),
  path: z.string(),
  requestName: z.string(),
  missing: z.boolean(),
})
export const testCaseSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  precondition: z.string(),
  steps: z.array(z.string()),
  expected: z.array(z.string()),
  createdBy: z.string(),
  viaKey: z.nullable(z.string()),
})

export const storyDetailsSchema = z.object({
  storyId: z.string(),
  stage: z.enum(STORY_STAGES),
  userStory: z.object({ role: z.string(), action: z.string(), benefit: z.string() }),
  flow: z.string(),
  definitionOfDone: z.array(dodItemSchema),
  designs: z.array(designSchema),
  designApprovedBy: z.nullable(z.string()),
  designApprovedAt: z.nullable(z.string()),
  contracts: z.array(contractSchema),
  testCases: z.array(testCaseSchema),
})

export const subtaskSchema = z.object({ id: z.string(), title: z.string(), done: z.boolean(), assigneeEmail: z.nullable(z.string()) })

export type DodItem = z.infer<typeof dodItemSchema>
export type StoryDesign = z.infer<typeof designSchema>
export type StoryContract = z.infer<typeof contractSchema>
export type StoryTestCase = z.infer<typeof testCaseSchema>
export type StoryDetails = z.infer<typeof storyDetailsSchema>
export type Subtask = z.infer<typeof subtaskSchema>

// Copyable text of a test case, the same text QA hands to Playwright.
export function testCaseText(testCase: StoryTestCase, labels: { precondition: string; steps: string; expected: string }): string {
  return [
    `${labels.precondition}: ${testCase.precondition}`,
    `${labels.steps}:`,
    ...testCase.steps.map((step, index) => `  ${index + 1}. ${step}`),
    `${labels.expected}:`,
    ...testCase.expected.map((line) => `  - ${line}`),
  ].join('\n')
}

export function storyStage(status: string): StoryStage {
  if (status === 'refinement' || status === 'design') return 'design'
  if (status === 'ready' || status === 'design_approved') return 'design_approved'
  if (status === 'in_progress') return 'in_progress'
  if (status === 'review' || status === 'qa') return 'qa'
  if (status === 'done') return 'done'
  return 'draft'
}
