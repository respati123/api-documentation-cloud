import * as z from 'zod/mini'
import type {
  AppName,
  AppProject,
  DbdesignTable,
  LinkedProjectItems,
  StitchkitScreen,
  WorkspaceApps,
} from '@/features/app-integrations/models/app-integrations.model'
import { apiCall } from '@/shared/services/api-client'

const linkSchema = z.object({ id: z.string(), projectId: z.string(), name: z.string(), url: z.nullable(z.string()) })
const appsSchema = z.object({
  canManage: z.boolean(),
  apps: z.array(
    z.object({ app: z.enum(['dbdesign', 'stitchkit']), enabled: z.boolean(), baseUrl: z.nullable(z.string()), links: z.array(linkSchema) }),
  ),
})
const projectsSchema = z.object({ projects: z.array(z.object({ id: z.string(), name: z.string() })) })
const linkedSchema = <T extends z.ZodMiniType>(item: T) =>
  z.object({
    projects: z.array(z.object({ projectId: z.string(), projectName: z.string(), items: z.array(item), error: z.nullable(z.string()) })),
  })
const screensSchema = linkedSchema(z.object({ id: z.string(), name: z.string(), url: z.nullable(z.string()) }))
const tablesSchema = linkedSchema(z.object({ id: z.string(), name: z.string() }))

const base = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}/apps`

export const appIntegrationsService = {
  list: async (workspaceId: string): Promise<WorkspaceApps> => z.parse(appsSchema, await apiCall(base(workspaceId))),
  available: async (workspaceId: string, app: AppName): Promise<AppProject[]> =>
    z.parse(projectsSchema, await apiCall(`${base(workspaceId)}/${app}/available`)).projects,
  link: async (workspaceId: string, app: AppName, appProjectId: string) => {
    await apiCall(`${base(workspaceId)}/${app}/links`, { method: 'POST', body: { appProjectId } })
  },
  unlink: async (workspaceId: string, linkId: string) => {
    await apiCall(`${base(workspaceId)}/links/${encodeURIComponent(linkId)}`, { method: 'DELETE' })
  },
  stitchkitScreens: async (workspaceId: string): Promise<LinkedProjectItems<StitchkitScreen>[]> =>
    z.parse(screensSchema, await apiCall(`${base(workspaceId)}/stitchkit/screens`)).projects as LinkedProjectItems<StitchkitScreen>[],
  dbdesignTables: async (workspaceId: string): Promise<LinkedProjectItems<DbdesignTable>[]> =>
    z.parse(tablesSchema, await apiCall(`${base(workspaceId)}/dbdesign/tables`)).projects as LinkedProjectItems<DbdesignTable>[],
}

export const appIntegrationsKeys = {
  all: ['app-integrations'] as const,
  list: (workspaceId: string) => ['app-integrations', workspaceId, 'list'] as const,
  available: (workspaceId: string, app: AppName) => ['app-integrations', workspaceId, 'available', app] as const,
  screens: (workspaceId: string) => ['app-integrations', workspaceId, 'screens'] as const,
  tables: (workspaceId: string) => ['app-integrations', workspaceId, 'tables'] as const,
}
