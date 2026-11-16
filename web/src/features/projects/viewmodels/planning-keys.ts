import type { TargetKind } from '@/features/projects/models/planning.model'

export const planningKeys = {
  all: (workspaceId: string) => ['planning', workspaceId] as const,
  documents: (workspaceId: string) => ['planning', workspaceId, 'documents'] as const,
  document: (workspaceId: string, id: string) => ['planning', workspaceId, 'document', id] as const,
  version: (workspaceId: string, id: string, version: number) => ['planning', workspaceId, 'document', id, 'version', version] as const,
  file: (workspaceId: string, id: string, version: number) => ['planning', workspaceId, 'document', id, 'file', version] as const,
  items: (workspaceId: string) => ['planning', workspaceId, 'items'] as const,
  events: (workspaceId: string) => ['planning', workspaceId, 'events'] as const,
  comments: (workspaceId: string, kind: TargetKind, id: string) => ['planning', workspaceId, 'comments', kind, id] as const,
}
