import type { ApiNode } from '@/shared/models/cloud-workspace.model'
import { isSensitiveName, MASKED_VALUE, redactText } from './redact'

export type ChangeKind = 'added' | 'modified' | 'deleted'

export interface SnapshotChange {
  id: string
  label: string
  kind: ChangeKind
  before: string
  after: string
}

export function compareSnapshots(before: ApiNode[], after: ApiNode[]): SnapshotChange[] {
  const previous = flatten(before)
  const current = flatten(after)
  const ids = new Set([...previous.keys(), ...current.keys()])

  return [...ids].flatMap((id) => {
    const oldNode = previous.get(id)
    const newNode = current.get(id)
    const oldText = oldNode ? JSON.stringify(publicNode(oldNode), null, 2) : ''
    const newText = newNode ? JSON.stringify(publicNode(newNode), null, 2) : ''
    if (oldText === newText) return []
    const node = newNode ?? oldNode
    if (!node) return []
    return [
      {
        id,
        label: node.kind === 'request' ? `${node.method} ${node.name}` : node.name,
        kind: !oldNode ? 'added' : !newNode ? 'deleted' : 'modified',
        before: oldText,
        after: newText,
      },
    ]
  })
}

function flatten(nodes: ApiNode[]): Map<string, ApiNode> {
  const result = new Map<string, ApiNode>()
  const visit = (items: ApiNode[]) => {
    for (const node of items) {
      result.set(node.id, node.kind === 'folder' ? { id: node.id, kind: 'folder', name: node.name, children: [] } : node)
      if (node.kind === 'folder') visit(node.children)
    }
  }
  visit(nodes)
  return result
}

function masked(rows: Array<{ name: string; value: string }> | undefined) {
  return (rows ?? []).map((row) => ({ ...row, value: isSensitiveName(row.name) ? MASKED_VALUE : row.value }))
}

function publicNode(node: ApiNode): Record<string, unknown> {
  if (node.kind === 'folder') return { kind: node.kind, name: node.name }
  return {
    kind: node.kind,
    name: node.name,
    method: node.method,
    url: node.url,
    documentation: node.documentation || '',
    params: masked(node.params),
    headers: masked(node.headers),
    auth: !node.auth || node.auth.type === 'none' ? { type: 'none' } : { type: node.auth.type },
    bodyMode: node.bodyMode || (node.body.trim() ? 'json' : 'none'),
    body: redactText(node.body),
    responses: (node.responses ?? []).map((response) => ({
      ...response,
      content: response.content.map((content) => ({ ...content, example: redactText(content.example) })),
    })),
    deprecated: Boolean(node.deprecated),
    deprecationReason: node.deprecationReason || '',
  }
}
