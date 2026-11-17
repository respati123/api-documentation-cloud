import type { ChangeTreeGroup, DiffStats, FileDiff } from '@/features/workspace-detail/models/history.model'
import type { SnapshotChange } from '@/features/workspace-detail/utils/snapshot-diff'
import { buildBlocks, diffLines, diffStats, toSplitRows } from '@/features/workspace-detail/utils/text-diff'

export function fileAnchorId(fileId: string): string {
  return `history-file-${fileId}`
}

export function shortCommitId(id: string): string {
  return id.slice(0, 7)
}

function localDayKey(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// Items arrive newest first, so groups come out newest first too.
export function groupByDay<T>(items: T[], dateOf: (item: T) => string): Array<{ key: string; date: string; items: T[] }> {
  const groups: Array<{ key: string; date: string; items: T[] }> = []
  for (const item of items) {
    const key = localDayKey(dateOf(item))
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(item)
    else groups.push({ key, date: dateOf(item), items: [item] })
  }
  return groups
}

export function buildFileDiffs(changes: SnapshotChange[]): FileDiff[] {
  return changes.map((change) => {
    const lines = diffLines(change.before, change.after)
    return {
      id: change.id,
      kind: change.kind,
      nodeKind: change.nodeKind,
      method: change.method,
      name: change.name,
      url: change.url,
      path: change.path,
      stats: diffStats(lines),
      blocks: buildBlocks(lines).map((block) => ({ ...block, splitRows: toSplitRows(block.lines) })),
    }
  })
}

export function diffTotals(files: FileDiff[]): DiffStats & { files: number } {
  return files.reduce(
    (totals, file) => ({ files: totals.files + 1, added: totals.added + file.stats.added, removed: totals.removed + file.stats.removed }),
    {
      files: 0,
      added: 0,
      removed: 0,
    },
  )
}

export function buildChangeTree(files: FileDiff[]): ChangeTreeGroup[] {
  const groups = new Map<string, ChangeTreeGroup>()
  for (const file of files) {
    const id = file.path.join('/')
    const entry = { id: file.id, kind: file.kind, nodeKind: file.nodeKind, method: file.method, name: file.name, stats: file.stats }
    const group = groups.get(id)
    if (group) group.files.push(entry)
    else groups.set(id, { id, path: file.path, files: [entry] })
  }
  return [...groups.values()]
}
