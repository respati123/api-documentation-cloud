import type { TreeNode } from '@/models/workspace'

// One item a push changed, as a teammate's notification lists it. Folders carry no method.
export type ChangeSummary = { id: string; name: string; status: 'added' | 'modified' | 'deleted'; method?: string; folder?: string }

// A notification lists at most this many items. The rest are counted, not sent.
export const maxChangeSummary = 20

type Entry = { node: TreeNode; folder?: string }

function flatten(tree: TreeNode[], folder: string | undefined, out: Map<string, Entry>): Map<string, Entry> {
  for (const node of tree) {
    out.set(node.id, { node, folder })
    if (node.kind === 'folder') flatten(node.children, node.name, out)
  }
  return out
}

// A folder's own fields. Its children are compared as entries of their own.
function fields(node: TreeNode): string {
  if (node.kind === 'folder') return JSON.stringify({ kind: node.kind, name: node.name })
  return JSON.stringify(node)
}

// The items that differ between two trees: added, modified, or deleted. Order follows the newer tree, then the older one.
export function summarizeChanges(before: TreeNode[], after: TreeNode[]): ChangeSummary[] {
  const older = flatten(before, undefined, new Map())
  const newer = flatten(after, undefined, new Map())
  const changes: ChangeSummary[] = []
  const describe = (id: string, entry: Entry, status: ChangeSummary['status']): ChangeSummary => ({
    id,
    name: entry.node.name,
    status,
    ...(entry.node.kind === 'request' ? { method: entry.node.method } : {}),
    ...(entry.folder ? { folder: entry.folder } : {}),
  })
  for (const [id, entry] of newer) {
    const previous = older.get(id)
    if (!previous) changes.push(describe(id, entry, 'added'))
    else if (fields(previous.node) !== fields(entry.node) || previous.folder !== entry.folder) changes.push(describe(id, entry, 'modified'))
  }
  for (const [id, entry] of older) {
    if (!newer.has(id)) changes.push(describe(id, entry, 'deleted'))
  }
  return changes
}
