import type { SQL } from 'bun'

export type PlanningDocumentRow = {
  id: string
  workspaceId: string
  kind: string
  title: string
  status: string
  currentVersion: number
  sourceDocumentId: string | null
  approvedBy: string | null
  approvedAt: Date | null
  createdAt: Date
  updatedAt: Date
  content: string
  fileName: string | null
  mimeType: string | null
  sourceVersion: number | null
  sourceOutdated: boolean | null
}

export async function findPlanningDocument(db: SQL, workspaceId: string, documentId: string): Promise<PlanningDocumentRow | undefined> {
  const [row] = await db`SELECT d.id, d.workspace_id AS "workspaceId", d.kind, d.title, d.status, d.current_version AS "currentVersion", d.source_document_id AS "sourceDocumentId", d.approved_by AS "approvedBy", d.approved_at AS "approvedAt", d.created_at AS "createdAt", d.updated_at AS "updatedAt", v.content, v.file_name AS "fileName", v.mime_type AS "mimeType", v.source_version AS "sourceVersion", (s.current_version > v.source_version) AS "sourceOutdated" FROM planning_documents d JOIN planning_document_versions v ON v.document_id = d.id AND v.version = d.current_version LEFT JOIN planning_documents s ON s.id = d.source_document_id WHERE d.id = ${documentId} AND d.workspace_id = ${workspaceId}`
  return row
}

export async function listPlanningDocumentRows(db: SQL, workspaceId: string): Promise<Array<{ kind: string; status: string } & Record<string, unknown>>> {
  return db`SELECT d.id, d.kind, d.title, d.status, d.current_version AS "currentVersion", d.source_document_id AS "sourceDocumentId", d.approved_at AS "approvedAt", d.updated_at AS "updatedAt", (s.current_version > v.source_version) AS "sourceOutdated" FROM planning_documents d JOIN planning_document_versions v ON v.document_id = d.id AND v.version = d.current_version LEFT JOIN planning_documents s ON s.id = d.source_document_id WHERE d.workspace_id = ${workspaceId} ORDER BY d.updated_at DESC LIMIT 100`
}

export async function listPlanningDocumentVersions(db: SQL, documentId: string) {
  return db`SELECT version, file_name AS "fileName", mime_type AS "mimeType", source_version AS "sourceVersion", created_at AS "createdAt" FROM planning_document_versions WHERE document_id = ${documentId} ORDER BY version DESC`
}

export async function findPlanningDocumentVersion(db: SQL, documentId: string, version: number) {
  const [row] = await db`SELECT version, content, file_name AS "fileName", mime_type AS "mimeType", source_version AS "sourceVersion", created_at AS "createdAt" FROM planning_document_versions WHERE document_id = ${documentId} AND version = ${version}`
  return row as Record<string, unknown> | undefined
}

export async function findPlanningDocumentFile(db: SQL, documentId: string, version: number): Promise<{ fileBytes: Uint8Array | null; fileName: string | null; mimeType: string | null } | undefined> {
  const [row] = await db`SELECT file_bytes AS "fileBytes", file_name AS "fileName", mime_type AS "mimeType" FROM planning_document_versions WHERE document_id = ${documentId} AND version = ${version}`
  return row
}

export async function insertPlanningDocument(db: SQL, row: { id: string; workspaceId: string; kind: string; title: string; status: string; sourceDocumentId: string | null; createdBy: string }) {
  // A document belongs to the project of its workspace. The service makes sure the workspace has one.
  await db`INSERT INTO planning_documents (id, workspace_id, project_id, kind, title, status, source_document_id, created_by) VALUES (${row.id}, ${row.workspaceId}, (SELECT id FROM projects WHERE workspace_id = ${row.workspaceId} ORDER BY created_at, id LIMIT 1), ${row.kind}, ${row.title}, ${row.status}, ${row.sourceDocumentId}, ${row.createdBy})`
}

export async function insertPlanningDocumentVersion(
  db: SQL,
  row: { documentId: string; version: number; content: string; fileName?: string | null; mimeType?: string | null; fileBytes?: Uint8Array | null; sourceVersion: number | null; createdBy: string },
) {
  await db`INSERT INTO planning_document_versions (document_id, version, content, file_name, mime_type, file_bytes, source_version, created_by) VALUES (${row.documentId}, ${row.version}, ${row.content}, ${row.fileName ?? null}, ${row.mimeType ?? null}, ${row.fileBytes ?? null}, ${row.sourceVersion}, ${row.createdBy})`
}

// Moves the document to a new version, only if nobody else did since expectedVersion was read.
export async function bumpPlanningDocumentVersion(db: SQL, row: { workspaceId: string; documentId: string; expectedVersion: number; title: string; status: string }): Promise<number | undefined> {
  const [updated] = await db`UPDATE planning_documents SET title = ${row.title}, current_version = current_version + 1, status = ${row.status}, approved_by = NULL, approved_at = NULL, updated_at = now() WHERE id = ${row.documentId} AND workspace_id = ${row.workspaceId} AND current_version = ${row.expectedVersion} RETURNING current_version AS "currentVersion"`
  return updated ? Number(updated.currentVersion) : undefined
}

export async function updatePlanningDocumentStatus(
  db: SQL,
  row: { workspaceId: string; documentId: string; from: string; version: number; status: string; approvedBy: string | null; approvedAt: Date | null },
): Promise<boolean> {
  const [updated] = await db`UPDATE planning_documents SET status = ${row.status}, approved_by = ${row.approvedBy}, approved_at = ${row.approvedAt}, updated_at = now() WHERE id = ${row.documentId} AND workspace_id = ${row.workspaceId} AND status = ${row.from} AND current_version = ${row.version} RETURNING id`
  return updated !== undefined
}

// PRDs and epics or stories drafted from the document.
export async function countDocumentDependents(db: SQL, workspaceId: string, documentId: string): Promise<number> {
  const [row] = await db`SELECT (SELECT count(*) FROM planning_documents WHERE workspace_id = ${workspaceId} AND source_document_id = ${documentId}) + (SELECT count(*) FROM issues i JOIN projects p ON p.id = i.project_id WHERE p.workspace_id = ${workspaceId} AND i.source_document_id = ${documentId}) AS n`
  return Number(row.n)
}

// Versions go with the document. Comments point at it by id only, so they are removed here.
export async function deletePlanningDocumentRows(db: SQL, workspaceId: string, documentId: string): Promise<void> {
  await db`DELETE FROM planning_comments WHERE workspace_id = ${workspaceId} AND target_kind = 'document' AND target_id = ${documentId}`
  await db`DELETE FROM planning_documents WHERE id = ${documentId} AND workspace_id = ${workspaceId}`
}
