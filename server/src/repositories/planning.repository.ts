import type { SQL } from 'bun'

export async function listParticipatingStories(db: SQL, workspaceId: string, userId: string) {
  return db`SELECT i.id, i.kind, i.parent_id AS "parentId", i.title, i.description, i.acceptance_criteria AS "acceptanceCriteria", i.status, i.published_at AS "publishedAt", i.source_document_id AS "sourceDocumentId", i.source_version AS "sourceVersion", i.source_section AS "sourceSection" FROM planning_items i JOIN planning_participants pp ON pp.item_id = i.id WHERE i.workspace_id = ${workspaceId} AND i.kind = 'story' AND i.published_at IS NOT NULL AND pp.user_id = ${userId} ORDER BY i.created_at LIMIT 500`
}

// A participant of the story, or of a story under the epic.
export async function isItemParticipant(db: SQL, workspaceId: string, itemId: string, userId: string): Promise<boolean> {
  const [row] = await db`SELECT 1 FROM planning_participants pp JOIN planning_items i ON i.id = pp.item_id WHERE pp.user_id = ${userId} AND i.workspace_id = ${workspaceId} AND (i.id = ${itemId} OR (i.kind = 'story' AND i.parent_id = ${itemId})) LIMIT 1`
  return row !== undefined
}

export async function isStoryParticipant(db: SQL, workspaceId: string, storyId: string, userId: string): Promise<boolean> {
  const [row] = await db`SELECT 1 FROM planning_items i JOIN planning_participants pp ON pp.item_id = i.id WHERE i.id = ${storyId} AND i.workspace_id = ${workspaceId} AND i.kind = 'story' AND i.published_at IS NOT NULL AND pp.user_id = ${userId} LIMIT 1`
  return row !== undefined
}
