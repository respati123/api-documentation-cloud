import { isSensitiveName, MASKED_VALUE, redactText } from '@/features/workspace-detail/utils/redact'
import type { ApiNode, KeyValueRow, RequestNode } from '@/shared/models/cloud-workspace.model'

export type ChangeKind = 'added' | 'modified' | 'deleted'

export interface SnapshotChange {
  id: string
  label: string
  kind: ChangeKind
  nodeKind: ApiNode['kind']
  name: string
  method: string
  url: string
  // Folder names from the collection root down to the item's parent.
  path: string[]
  before: string
  after: string
}

interface FlatNode {
  node: ApiNode
  path: string[]
}

export function compareSnapshots(before: ApiNode[], after: ApiNode[]): SnapshotChange[] {
  const previous = flatten(before)
  const current = flatten(after)
  const ids = new Set([...previous.keys(), ...current.keys()])

  return [...ids].flatMap((id) => {
    const oldEntry = previous.get(id)
    const newEntry = current.get(id)
    const oldText = oldEntry ? describeNode(oldEntry.node) : ''
    const newText = newEntry ? describeNode(newEntry.node) : ''
    if (oldText === newText) return []
    const entry = newEntry ?? oldEntry
    if (!entry) return []
    const { node, path } = entry
    const isRequest = node.kind === 'request'
    return [
      {
        id,
        label: isRequest ? `${node.method} ${node.name}` : node.name,
        kind: !oldEntry ? 'added' : !newEntry ? 'deleted' : 'modified',
        nodeKind: node.kind,
        name: node.name,
        method: isRequest ? node.method : '',
        url: isRequest ? node.url : '',
        path,
        before: oldText,
        after: newText,
      },
    ]
  })
}

// The text both sides of a diff compare. Fields are listed in a fixed order and row ids are left out,
// so only what a reader would call a change shows up.
export function describeNode(node: ApiNode): string {
  return JSON.stringify(publicNode(node), null, 2)
}

function flatten(nodes: ApiNode[]): Map<string, FlatNode> {
  const result = new Map<string, FlatNode>()
  const visit = (items: ApiNode[], path: string[]) => {
    for (const node of items) {
      result.set(node.id, { node, path })
      if (node.kind === 'folder') visit(node.children, [...path, node.name])
    }
  }
  visit(nodes, [])
  return result
}

// A JSON body is embedded as a value, so the diff shows one field per line instead of one escaped string.
function readable(text: string | undefined): unknown {
  const redacted = redactText(text ?? '')
  try {
    return JSON.parse(redacted)
  } catch {
    return redacted
  }
}

function rows(items: KeyValueRow[] | undefined) {
  return (items ?? []).map((row) => ({
    name: row.name,
    value: isSensitiveName(row.name) ? MASKED_VALUE : row.value,
    enabled: row.enabled,
    ...(row.description ? { description: row.description } : {}),
  }))
}

function bodyFields(fields: RequestNode['bodyFields']) {
  return (fields ?? []).map((field) => ({
    name: field.name,
    type: field.type,
    value: field.type === 'file' ? (field.fileName ?? '') : isSensitiveName(field.name) ? MASKED_VALUE : field.value,
    enabled: field.enabled,
  }))
}

function publicNode(node: ApiNode): Record<string, unknown> {
  if (node.kind === 'folder') return { kind: node.kind, name: node.name }
  return {
    kind: node.kind,
    name: node.name,
    method: node.method,
    url: node.url,
    documentation: node.documentation || '',
    pathParams: rows(node.pathParams),
    params: rows(node.params),
    headers: rows(node.headers),
    auth: !node.auth || node.auth.type === 'none' ? { type: 'none' } : { type: node.auth.type },
    bodyMode: node.bodyMode || (node.body.trim() ? 'json' : 'none'),
    body: readable(node.body),
    bodyFields: bodyFields(node.bodyFields),
    bodyVariables: readable(node.bodyVariables),
    responses: (node.responses ?? []).map((response) => ({
      statusCode: response.statusCode,
      description: response.description,
      content: response.content.map((content) => ({
        mediaType: content.mediaType,
        schema: readable(content.schema),
        example: readable(content.example),
      })),
    })),
    deprecated: Boolean(node.deprecated),
    deprecationReason: node.deprecationReason || '',
  }
}
