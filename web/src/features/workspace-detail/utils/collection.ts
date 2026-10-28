import type { ApiNode, RequestNode } from '@/shared/models/cloud-workspace.model'

export function countRequests(nodes: ApiNode[]): number {
  return nodes.reduce((total, node) => total + (node.kind === 'request' ? 1 : countRequests(node.children)), 0)
}

export function countFolders(nodes: ApiNode[]): number {
  return nodes.reduce((total, node) => (node.kind === 'folder' ? total + 1 + countFolders(node.children) : total), 0)
}

export function firstRequest(nodes: ApiNode[]): RequestNode | null {
  for (const node of nodes) {
    if (node.kind === 'request') return node
    const nested = firstRequest(node.children)
    if (nested) return nested
  }
  return null
}

export function findRequest(nodes: ApiNode[], id: string): RequestNode | null {
  for (const node of nodes) {
    if (node.kind === 'request' && node.id === id) return node
    if (node.kind === 'folder') {
      const nested = findRequest(node.children, id)
      if (nested) return nested
    }
  }
  return null
}

export function filterCollection(nodes: ApiNode[], query: string): ApiNode[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return nodes
  const result: ApiNode[] = []
  for (const node of nodes) {
    if (node.kind === 'request') {
      if (`${node.method} ${node.name} ${node.url}`.toLowerCase().includes(needle)) result.push(node)
      continue
    }
    const children = filterCollection(node.children, needle)
    if (children.length) result.push({ ...node, children })
  }
  return result
}
