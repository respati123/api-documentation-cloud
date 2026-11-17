import { demoRequest } from '@/features/projects/services/mock/planning-mock-api'
import { isDemoWorkspace } from '@/features/projects/stores/planning-demo.store'
import { apiCall } from '@/shared/services/api-client'

interface CallOptions {
  token?: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

// Project requests go to the server, or to the sample data while the workspace shows it. `path` starts after /api/workspaces/{id}.
export function workspaceCall(workspaceId: string, path: string, options: CallOptions = {}): Promise<unknown> {
  if (isDemoWorkspace(workspaceId)) return demoRequest(options.method ?? 'GET', path, options.body)
  return apiCall(`/api/workspaces/${workspaceId}${path}`, options)
}

export function isSampleWorkspace(workspaceId: string): boolean {
  return isDemoWorkspace(workspaceId)
}
