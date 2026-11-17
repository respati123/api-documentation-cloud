import { isRecord } from '@/lib/validation'
import { contractPath } from '@/services/stories'

export type FoundRequest = { id: string; name: string; method: string; url: string; path: string; folder: string }

const LIMIT = 50

// Requests in a workspace collection whose name, url, or folder contains the query, optionally of one method.
// The agent uses the id with story_link_api_contract.
export function searchCollectionRequests(snapshot: unknown, filter: { query?: string; method?: string }): FoundRequest[] {
  const query = filter.query?.trim().toLowerCase() ?? ''
  const method = filter.method?.trim().toUpperCase() ?? ''
  const found: FoundRequest[] = []
  const walk = (nodes: unknown, folders: string[]) => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes) {
      if (found.length >= LIMIT || !isRecord(node)) continue
      if (node.kind === 'folder') walk(node.children, [...folders, String(node.name ?? '')])
      if (node.kind !== 'request' || typeof node.id !== 'string') continue
      const request = { id: node.id, name: String(node.name ?? ''), method: String(node.method ?? 'GET').toUpperCase(), url: String(node.url ?? ''), folder: folders.join(' / ') }
      const text = `${request.name} ${request.url} ${request.folder}`.toLowerCase()
      if ((!method || request.method === method) && (!query || text.includes(query))) found.push({ ...request, path: contractPath(request.url) })
    }
  }
  if (isRecord(snapshot)) walk(snapshot.tree, [])
  return found
}
