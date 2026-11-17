// Line diff in the shape of a GitHub commit view: numbered lines, word highlights inside edited lines,
// hunks with three lines of context, and folded gaps between them. Ported from the desktop app's text-diff.

export type DiffLineKind = 'same' | 'added' | 'removed'

export interface DiffSegment {
  text: string
  changed: boolean
}

export interface DiffLine {
  kind: DiffLineKind
  oldLine: number | null
  newLine: number | null
  text: string
  segments: DiffSegment[]
}

export type DiffBlock = { kind: 'hunk'; id: string; header: string; lines: DiffLine[] } | { kind: 'gap'; id: string; lines: DiffLine[] }

export interface SplitRow {
  left: DiffLine | null
  right: DiffLine | null
}

export const DIFF_CONTEXT_LINES = 3

// Above this many table cells the comparison would be slow, so the sides are shown as fully removed and added.
const MAX_LINE_CELLS = 500_000
const MAX_TOKEN_CELLS = 40_000

type Op<T> = { kind: DiffLineKind; left: T | null; right: T | null; leftIndex: number; rightIndex: number }

function longestCommon<T>(left: T[], right: T[], maxCells: number): Op<T>[] | null {
  const columns = right.length + 1
  const cells = (left.length + 1) * columns
  if (cells > maxCells) return null
  const lengths = new Uint32Array(cells)
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      const cell = i * columns + j
      lengths[cell] =
        left[i] === right[j] ? lengths[(i + 1) * columns + j + 1] + 1 : Math.max(lengths[(i + 1) * columns + j], lengths[cell + 1])
    }
  }
  const ops: Op<T>[] = []
  let i = 0
  let j = 0
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      ops.push({ kind: 'same', left: left[i], right: right[j], leftIndex: i, rightIndex: j })
      i++
      j++
    } else if (i < left.length && (j >= right.length || lengths[(i + 1) * columns + j] >= lengths[i * columns + j + 1])) {
      ops.push({ kind: 'removed', left: left[i], right: null, leftIndex: i, rightIndex: j })
      i++
    } else {
      ops.push({ kind: 'added', left: null, right: right[j], leftIndex: i, rightIndex: j })
      j++
    }
  }
  return ops
}

function splitLines(text: string): string[] {
  return text ? text.split('\n') : []
}

export function diffLines(before: string, after: string): DiffLine[] {
  const left = splitLines(before)
  const right = splitLines(after)
  const ops = longestCommon(left, right, MAX_LINE_CELLS) ?? [
    ...left.map((text, index): Op<string> => ({ kind: 'removed', left: text, right: null, leftIndex: index, rightIndex: 0 })),
    ...right.map((text, index): Op<string> => ({ kind: 'added', left: null, right: text, leftIndex: 0, rightIndex: index })),
  ]
  const result = ops.map((op): DiffLine => {
    const text = op.kind === 'added' ? (op.right ?? '') : (op.left ?? '')
    return {
      kind: op.kind,
      oldLine: op.kind === 'added' ? null : op.leftIndex + 1,
      newLine: op.kind === 'removed' ? null : op.rightIndex + 1,
      text,
      segments: [{ text, changed: false }],
    }
  })
  highlightWords(result)
  return result
}

// Pairs each run of removed lines with the added lines that follow it, then marks the words that differ.
function highlightWords(lines: DiffLine[]) {
  let index = 0
  while (index < lines.length) {
    if (lines[index].kind === 'same') {
      index++
      continue
    }
    const removed: DiffLine[] = []
    const added: DiffLine[] = []
    while (index < lines.length && lines[index].kind !== 'same') {
      if (lines[index].kind === 'removed') removed.push(lines[index])
      else added.push(lines[index])
      index++
    }
    for (let pair = 0; pair < Math.min(removed.length, added.length); pair++) {
      const segments = diffWords(removed[pair].text, added[pair].text)
      if (!segments) continue
      removed[pair].segments = segments.left
      added[pair].segments = segments.right
    }
  }
}

function tokenize(text: string): string[] {
  return text.match(/\w+|\s+|[^\w\s]/g) ?? []
}

function pushSegment(segments: DiffSegment[], text: string, changed: boolean) {
  const last = segments[segments.length - 1]
  if (last && last.changed === changed) last.text += text
  else segments.push({ text, changed })
}

function diffWords(before: string, after: string): { left: DiffSegment[]; right: DiffSegment[] } | null {
  const ops = longestCommon(tokenize(before), tokenize(after), MAX_TOKEN_CELLS)
  if (!ops) return null
  const left: DiffSegment[] = []
  const right: DiffSegment[] = []
  for (const op of ops) {
    if (op.kind !== 'added' && op.left !== null) pushSegment(left, op.left, op.kind === 'removed')
    if (op.kind !== 'removed' && op.right !== null) pushSegment(right, op.right, op.kind === 'added')
  }
  return { left, right }
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const line of lines) {
    if (line.kind === 'added') added++
    else if (line.kind === 'removed') removed++
  }
  return { added, removed }
}

function hunkHeader(lines: DiffLine[]): string {
  const oldLines = lines.filter((line) => line.oldLine !== null)
  const newLines = lines.filter((line) => line.newLine !== null)
  const oldStart = oldLines[0]?.oldLine ?? 0
  const newStart = newLines[0]?.newLine ?? 0
  return `@@ -${oldStart},${oldLines.length} +${newStart},${newLines.length} @@`
}

export function buildBlocks(lines: DiffLine[], context = DIFF_CONTEXT_LINES): DiffBlock[] {
  if (lines.length === 0) return []
  const visible = new Array<boolean>(lines.length).fill(false)
  lines.forEach((line, index) => {
    if (line.kind === 'same') return
    for (let near = Math.max(0, index - context); near <= Math.min(lines.length - 1, index + context); near++) visible[near] = true
  })

  const blocks: DiffBlock[] = []
  let start = 0
  while (start < lines.length) {
    let end = start
    while (end < lines.length && visible[end] === visible[start]) end++
    const slice = lines.slice(start, end)
    const id = `${visible[start] ? 'hunk' : 'gap'}-${start}`
    blocks.push(visible[start] ? { kind: 'hunk', id, header: hunkHeader(slice), lines: slice } : { kind: 'gap', id, lines: slice })
    start = end
  }
  return blocks
}

export function toSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = []
  let index = 0
  while (index < lines.length) {
    if (lines[index].kind === 'same') {
      rows.push({ left: lines[index], right: lines[index] })
      index++
      continue
    }
    const removed: DiffLine[] = []
    const added: DiffLine[] = []
    while (index < lines.length && lines[index].kind !== 'same') {
      if (lines[index].kind === 'removed') removed.push(lines[index])
      else added.push(lines[index])
      index++
    }
    for (let pair = 0; pair < Math.max(removed.length, added.length); pair++) {
      rows.push({ left: removed[pair] ?? null, right: added[pair] ?? null })
    }
  }
  return rows
}
