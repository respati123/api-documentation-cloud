import type { SQL } from 'bun'

// The owner and editors with the given project roles. These are the people the planning service treats as PM or approver.
export async function listMembersWithDiscipline(db: SQL, workspaceId: string, disciplines: string[]): Promise<string[]> {
  const rows: Array<{ userId: string }> = await db`
    SELECT m.user_id AS "userId" FROM memberships m
    WHERE m.workspace_id = ${workspaceId} AND (m.role = 'owner' OR (m.role = 'editor' AND EXISTS (
      SELECT 1 FROM project_members pm JOIN projects p ON p.id = pm.project_id
      WHERE p.workspace_id = ${workspaceId} AND pm.user_id = m.user_id AND pm.discipline = ANY(ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(disciplines)}::text)::jsonb)))
    )))`
  return rows.map((row) => row.userId)
}

export async function findDocumentVisibility(db: SQL, workspaceId: string, documentId: string): Promise<{ kind: string; status: string } | undefined> {
  const [row] = await db`SELECT kind, status FROM planning_documents WHERE id = ${documentId} AND workspace_id = ${workspaceId}`
  return row
}

// For a story, its own participants. For an epic, the participants of its published stories, who can read the epic.
export async function findItemVisibility(db: SQL, workspaceId: string, itemId: string): Promise<{ published: boolean; participantIds: string[] } | undefined> {
  const [row] = await db`
    SELECT i.published_at IS NOT NULL AS published,
      coalesce((SELECT array_agg(DISTINCT pp.user_id) FROM planning_participants pp JOIN planning_items s ON s.id = pp.item_id
        WHERE s.id = i.id OR (i.kind = 'epic' AND s.parent_id = i.id AND s.published_at IS NOT NULL)), ARRAY[]::text[]) AS "participantIds"
    FROM planning_items i WHERE i.id = ${itemId} AND i.workspace_id = ${workspaceId}`
  return row
}

export async function findTaskAssigneeInWorkspace(db: SQL, workspaceId: string, taskId: string): Promise<string | null | undefined> {
  const [row] = await db`SELECT t.assignee_id AS "assigneeId" FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = ${taskId} AND p.workspace_id = ${workspaceId}`
  return row ? row.assigneeId : undefined
}

export async function findCommentTarget(db: SQL, workspaceId: string, commentId: string): Promise<{ targetKind: string; targetId: string } | undefined> {
  const [row] = await db`SELECT target_kind AS "targetKind", target_id AS "targetId" FROM planning_comments WHERE id = ${commentId} AND workspace_id = ${workspaceId}`
  return row
}
