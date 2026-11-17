import type { SQL } from 'bun'

export type AppName = 'dbdesign' | 'stitchkit'

export interface AppLinkRow {
  id: string
  workspaceId: string
  app: AppName
  appProjectId: string
  appProjectName: string
  createdAt: Date
}

export interface DataModelRow {
  id: string
  storyId: string
  appProjectId: string
  projectName: string
  tableId: string
  tableName: string
  createdAt: Date
}


// Returns false when the project is already linked to this workspace.
export async function insertAppLink(db: SQL, link: { id: string; workspaceId: string; app: AppName; appProjectId: string; appProjectName: string; createdBy: string }): Promise<boolean> {
  const rows = await db`INSERT INTO workspace_app_links (id, workspace_id, app, app_project_id, app_project_name, created_by)
    VALUES (${link.id}, ${link.workspaceId}, ${link.app}, ${link.appProjectId}, ${link.appProjectName}, ${link.createdBy})
    ON CONFLICT (workspace_id, app, app_project_id) DO NOTHING RETURNING id`
  return rows.length > 0
}

export async function listAppLinks(db: SQL, workspaceId: string, app?: AppName): Promise<AppLinkRow[]> {
  const rows = app
    ? await db`SELECT id, workspace_id AS "workspaceId", app, app_project_id AS "appProjectId", app_project_name AS "appProjectName", created_at AS "createdAt"
        FROM workspace_app_links WHERE workspace_id = ${workspaceId} AND app = ${app} ORDER BY created_at`
    : await db`SELECT id, workspace_id AS "workspaceId", app, app_project_id AS "appProjectId", app_project_name AS "appProjectName", created_at AS "createdAt"
        FROM workspace_app_links WHERE workspace_id = ${workspaceId} ORDER BY app, created_at`
  return rows as AppLinkRow[]
}

export async function findAppLink(db: SQL, workspaceId: string, app: AppName, appProjectId: string): Promise<AppLinkRow | null> {
  const [row] = await db`SELECT id, workspace_id AS "workspaceId", app, app_project_id AS "appProjectId", app_project_name AS "appProjectName", created_at AS "createdAt"
    FROM workspace_app_links WHERE workspace_id = ${workspaceId} AND app = ${app} AND app_project_id = ${appProjectId}`
  return row ? (row as AppLinkRow) : null
}

export async function deleteAppLink(db: SQL, workspaceId: string, linkId: string): Promise<boolean> {
  const rows = await db`DELETE FROM workspace_app_links WHERE id = ${linkId} AND workspace_id = ${workspaceId} RETURNING id`
  return rows.length > 0
}

// Returns false when the table is already part of the story's data model.
export async function insertDataModel(
  db: SQL,
  row: { id: string; storyId: string; appProjectId: string; projectName: string; tableId: string; tableName: string; createdBy: string; apiKeyId: string | null },
): Promise<boolean> {
  const rows = await db`INSERT INTO story_data_models (id, story_id, app_project_id, project_name, table_id, table_name, created_by, api_key_id)
    VALUES (${row.id}, ${row.storyId}, ${row.appProjectId}, ${row.projectName}, ${row.tableId}, ${row.tableName}, ${row.createdBy}, ${row.apiKeyId})
    ON CONFLICT (story_id, app_project_id, table_id) DO NOTHING RETURNING id`
  return rows.length > 0
}

export async function listDataModels(db: SQL, storyId: string): Promise<DataModelRow[]> {
  const rows = await db`SELECT id, story_id AS "storyId", app_project_id AS "appProjectId", project_name AS "projectName", table_id AS "tableId",
    table_name AS "tableName", created_at AS "createdAt" FROM story_data_models WHERE story_id = ${storyId} ORDER BY created_at`
  return rows as DataModelRow[]
}

export async function deleteDataModel(db: SQL, storyId: string, id: string): Promise<boolean> {
  const rows = await db`DELETE FROM story_data_models WHERE id = ${id} AND story_id = ${storyId} RETURNING id`
  return rows.length > 0
}
