import type { SQL } from 'bun'

// A participant of the story, or of a story under the epic.
export async function isItemParticipant(db: SQL, workspaceId: string, itemId: string, userId: string): Promise<boolean> {
  const [row] = await db`SELECT 1 FROM planning_participants pp JOIN issues i ON i.id = pp.item_id JOIN projects p ON p.id = i.project_id WHERE pp.user_id = ${userId} AND p.workspace_id = ${workspaceId} AND (i.id = ${itemId} OR (i.type = 'story' AND i.parent_id = ${itemId})) LIMIT 1`
  return row !== undefined
}

