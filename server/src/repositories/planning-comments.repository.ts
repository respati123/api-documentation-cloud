import type { SQL } from 'bun'

export async function listPlanningCommentRows(db: SQL, workspaceId: string, targetKind: string, targetId: string) {
  return db`SELECT c.id, c.target_kind AS "targetKind", c.target_id AS "targetId", c.parent_id AS "parentId", c.body, c.is_decision AS "isDecision", c.resolved_at AS "resolvedAt", c.created_by AS "createdBy", u.email AS "authorEmail", c.created_at AS "createdAt" FROM planning_comments c JOIN users u ON u.id = c.created_by WHERE c.workspace_id = ${workspaceId} AND c.target_kind = ${targetKind} AND c.target_id = ${targetId} ORDER BY c.created_at LIMIT 500`
}

export async function commentExistsOnTarget(db: SQL, workspaceId: string, commentId: string, targetKind: string, targetId: string): Promise<boolean> {
  const [row] = await db`SELECT 1 FROM planning_comments WHERE id = ${commentId} AND workspace_id = ${workspaceId} AND target_kind = ${targetKind} AND target_id = ${targetId}`
  return row !== undefined
}

export async function insertPlanningComment(db: SQL, row: { id: string; workspaceId: string; targetKind: string; targetId: string; parentId: string | null; body: string; isDecision: boolean; createdBy: string }) {
  await db`INSERT INTO planning_comments (id, workspace_id, target_kind, target_id, parent_id, body, is_decision, created_by) VALUES (${row.id}, ${row.workspaceId}, ${row.targetKind}, ${row.targetId}, ${row.parentId}, ${row.body}, ${row.isDecision}, ${row.createdBy})`
}

export async function findCommentAuthor(db: SQL, commentId: string): Promise<string | undefined> {
  const [row] = await db`SELECT created_by AS "createdBy" FROM planning_comments WHERE id = ${commentId}`
  return row?.createdBy
}

export async function findPlanningComment(db: SQL, workspaceId: string, commentId: string): Promise<{ targetKind: string; targetId: string; createdBy: string } | undefined> {
  const [row] = await db`SELECT target_kind AS "targetKind", target_id AS "targetId", created_by AS "createdBy" FROM planning_comments WHERE id = ${commentId} AND workspace_id = ${workspaceId}`
  return row
}

export async function resolvePlanningCommentRow(db: SQL, workspaceId: string, commentId: string, resolvedBy: string) {
  await db`UPDATE planning_comments SET resolved_at = now(), resolved_by = ${resolvedBy} WHERE id = ${commentId} AND workspace_id = ${workspaceId}`
}
