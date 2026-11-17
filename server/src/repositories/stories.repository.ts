import type { SQL } from 'bun'
import type { WorkRole } from '@/models/story'

export interface StoryRow {
  id: string
  title: string
  workspaceId: string
  status: string
  publishedAt: Date | null
  userStoryRole: string
  userStoryAction: string
  userStoryBenefit: string
  flow: string
  designApprovedAt: Date | null
  designApprovedByEmail: string | null
}

export async function findStory(db: SQL, workspaceId: string, storyId: string): Promise<StoryRow | undefined> {
  const [row] = await db`SELECT i.id, i.title, i.workspace_id AS "workspaceId", i.status, i.published_at AS "publishedAt", i.user_story_role AS "userStoryRole", i.user_story_action AS "userStoryAction", i.user_story_benefit AS "userStoryBenefit", i.flow, i.design_approved_at AS "designApprovedAt", u.email AS "designApprovedByEmail" FROM planning_items i LEFT JOIN users u ON u.id = i.design_approved_by WHERE i.id = ${storyId} AND i.workspace_id = ${workspaceId} AND i.kind = 'story'`
  return row
}

export async function isStoryParticipantAny(db: SQL, storyId: string, userId: string): Promise<boolean> {
  const [row] = await db`SELECT 1 FROM planning_participants WHERE item_id = ${storyId} AND user_id = ${userId}`
  return row !== undefined
}

export async function updateStoryText(db: SQL, storyId: string, input: { userStoryRole?: string; userStoryAction?: string; userStoryBenefit?: string; flow?: string }): Promise<void> {
  await db`UPDATE planning_items SET user_story_role = coalesce(${input.userStoryRole ?? null}, user_story_role), user_story_action = coalesce(${input.userStoryAction ?? null}, user_story_action), user_story_benefit = coalesce(${input.userStoryBenefit ?? null}, user_story_benefit), flow = coalesce(${input.flow ?? null}, flow), updated_at = now() WHERE id = ${storyId}`
}

export async function setDesignApproval(db: SQL, storyId: string, userId: string): Promise<boolean> {
  const rows = await db`UPDATE planning_items SET design_approved_by = ${userId}, design_approved_at = now(), updated_at = now() WHERE id = ${storyId} AND design_approved_at IS NULL RETURNING id`
  return rows.length > 0
}

export async function listDodItems(db: SQL, storyId: string): Promise<Array<{ id: string; text: string; role: WorkRole; done: boolean }>> {
  return db`SELECT id, text, role, done FROM story_dod_items WHERE story_id = ${storyId} ORDER BY position, created_at`
}

// The Definition of Done is edited as a whole list. Items that keep their id keep their done state.
export async function replaceDodItems(db: SQL, storyId: string, items: Array<{ id: string; text: string; role: WorkRole; done: boolean }>): Promise<void> {
  await db.begin(async (tx) => {
    await tx`DELETE FROM story_dod_items WHERE story_id = ${storyId}`
    for (const [index, item] of items.entries())
      await tx`INSERT INTO story_dod_items (id, story_id, text, role, done, position) VALUES (${item.id}, ${storyId}, ${item.text}, ${item.role}, ${item.done}, ${index})`
  })
}

export async function setDodDone(db: SQL, storyId: string, itemId: string, done: boolean, userId: string): Promise<boolean> {
  const rows = await db`UPDATE story_dod_items SET done = ${done}, done_by = ${done ? userId : null} WHERE id = ${itemId} AND story_id = ${storyId} RETURNING id`
  return rows.length > 0
}

export async function listDesigns(db: SQL, storyId: string) {
  return db`SELECT d.id, d.title, d.url, d.note, u.email AS "createdBy", k.name AS "viaKey" FROM story_designs d JOIN users u ON u.id = d.created_by LEFT JOIN mcp_keys k ON k.id = d.api_key_id WHERE d.story_id = ${storyId} ORDER BY d.created_at`
}

export async function insertDesign(db: SQL, input: { id: string; storyId: string; title: string; url: string; note: string; createdBy: string; apiKeyId: string | null }): Promise<void> {
  await db`INSERT INTO story_designs (id, story_id, title, url, note, created_by, api_key_id) VALUES (${input.id}, ${input.storyId}, ${input.title}, ${input.url}, ${input.note}, ${input.createdBy}, ${input.apiKeyId})`
}

export async function listContractLinks(db: SQL, storyId: string): Promise<Array<{ id: string; requestId: string }>> {
  return db`SELECT id, request_id AS "requestId" FROM story_contracts WHERE story_id = ${storyId} ORDER BY created_at`
}

export async function insertContractLink(db: SQL, input: { id: string; storyId: string; requestId: string; createdBy: string; apiKeyId: string | null }): Promise<boolean> {
  const rows = await db`INSERT INTO story_contracts (id, story_id, request_id, created_by, api_key_id) VALUES (${input.id}, ${input.storyId}, ${input.requestId}, ${input.createdBy}, ${input.apiKeyId}) ON CONFLICT (story_id, request_id) DO NOTHING RETURNING id`
  return rows.length > 0
}

export async function listTestCases(db: SQL, storyId: string) {
  return db`SELECT t.id, t.number, t.title, t.precondition, t.steps, t.expected, u.email AS "createdBy", k.name AS "viaKey" FROM story_test_cases t JOIN users u ON u.id = t.created_by LEFT JOIN mcp_keys k ON k.id = t.api_key_id WHERE t.story_id = ${storyId} ORDER BY t.number`
}

// Numbers are per story (TC-1, TC-2). The insert takes the next number inside one statement.
export async function insertTestCase(db: SQL, input: { id: string; storyId: string; title: string; precondition: string; steps: string[]; expected: string[]; createdBy: string; apiKeyId: string | null }): Promise<number> {
  const [row] = await db`INSERT INTO story_test_cases (id, story_id, number, title, precondition, steps, expected, created_by, api_key_id) VALUES (${input.id}, ${input.storyId}, (SELECT coalesce(max(number), 0) + 1 FROM story_test_cases WHERE story_id = ${input.storyId}), ${input.title}, ${input.precondition}, ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(input.steps)}::text)::jsonb)), ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(input.expected)}::text)::jsonb)), ${input.createdBy}, ${input.apiKeyId}) RETURNING number`
  return row.number
}

export async function countDesigns(db: SQL, storyId: string): Promise<number> {
  const [row] = await db`SELECT count(*)::int AS count FROM story_designs WHERE story_id = ${storyId}`
  return row.count
}

export async function findHeadSnapshot(db: SQL, workspaceId: string): Promise<unknown> {
  const [row] = await db`SELECT c.snapshot FROM workspaces w JOIN commits c ON c.id = w.head_commit_id AND c.workspace_id = w.id WHERE w.id = ${workspaceId}`
  return row?.snapshot
}

export async function listStoryParticipantIds(db: SQL, storyId: string): Promise<string[]> {
  const rows: Array<{ userId: string }> = await db`SELECT user_id AS "userId" FROM planning_participants WHERE item_id = ${storyId}`
  return rows.map((row) => row.userId)
}
