import type { ApiNode, RequestNode } from '@/shared/models/cloud-workspace.model'

export type BreakingReason = 'endpoint-removed' | 'method-changed' | 'path-changed' | 'response-removed' | 'response-field-removed'

export interface BreakingChange {
  nodeId: string
  method: string
  name: string
  reason: BreakingReason
  // Extra context for the reason: the old and new value, the status code, or the removed field.
  detail: string
}

function requestsById(nodes: ApiNode[]): Map<string, RequestNode> {
  const result = new Map<string, RequestNode>()
  const visit = (items: ApiNode[]) => {
    for (const node of items) {
      if (node.kind === 'request') result.set(node.id, node)
      else visit(node.children)
    }
  }
  visit(nodes)
  return result
}

function pathOf(url: string): string {
  return url.split(/[?#]/)[0].trim()
}

// Dotted paths of every key in a JSON value. Array items share one path, written as name[].
function fieldPaths(value: unknown, prefix = ''): Set<string> {
  const paths = new Set<string>()
  if (Array.isArray(value)) {
    for (const item of value) for (const path of fieldPaths(item, `${prefix}[]`)) paths.add(path)
    return paths
  }
  if (!value || typeof value !== 'object') return paths
  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    paths.add(path)
    for (const child of fieldPaths(nested, path)) paths.add(child)
  }
  return paths
}

function exampleFields(node: RequestNode): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  for (const response of node.responses ?? []) {
    const fields = new Set<string>()
    for (const content of response.content) {
      try {
        for (const path of fieldPaths(JSON.parse(content.example))) fields.add(path)
      } catch {
        // A non-JSON example has no fields to compare.
      }
    }
    result.set(response.statusCode, fields)
  }
  return result
}

// Changes that can break a caller written against the earlier version. Renames, docs, and additions are not breaking.
export function detectBreakingChanges(before: ApiNode[], after: ApiNode[]): BreakingChange[] {
  const previous = requestsById(before)
  const current = requestsById(after)
  const changes: BreakingChange[] = []

  for (const [id, old] of previous) {
    const change = (reason: BreakingReason, detail: string) =>
      changes.push({ nodeId: id, method: old.method, name: old.name, reason, detail })
    const next = current.get(id)
    if (!next) {
      change('endpoint-removed', `${old.method} ${pathOf(old.url)}`)
      continue
    }
    if (old.method.toUpperCase() !== next.method.toUpperCase()) change('method-changed', `${old.method} → ${next.method}`)
    if (pathOf(old.url) !== pathOf(next.url)) change('path-changed', `${pathOf(old.url)} → ${pathOf(next.url)}`)

    const oldFields = exampleFields(old)
    const newFields = exampleFields(next)
    for (const [status, fields] of oldFields) {
      const remaining = newFields.get(status)
      if (!remaining) {
        change('response-removed', status)
        continue
      }
      // A field counts once: when "team" is gone, "team.id" is not listed again.
      const removed = [...fields].filter((field) => !remaining.has(field))
      for (const field of removed) {
        const parentRemoved = removed.some((other) => other !== field && (field.startsWith(`${other}.`) || field.startsWith(`${other}[]`)))
        if (!parentRemoved) change('response-field-removed', `${status} ${field}`)
      }
    }
  }
  return changes
}
