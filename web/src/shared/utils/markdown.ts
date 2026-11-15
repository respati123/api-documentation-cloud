// A small markdown reader for planning documents. It covers what BRDs, PRDs, and story flows use,
// and returns plain data, so the text is rendered by React and never as HTML.

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; label: Inline[]; href: string }

export type TableAlign = 'left' | 'center' | 'right'
export type ListItem = { content: Inline[]; children: MarkdownBlock[] }

export type MarkdownBlock =
  | { type: 'heading'; id: string; level: 2 | 3 | 4; content: Inline[] }
  | { type: 'paragraph'; lines: Inline[][] }
  | { type: 'list'; ordered: boolean; start: number; items: ListItem[] }
  | { type: 'table'; hasHeader: boolean; align: TableAlign[]; header: Inline[][]; rows: Inline[][][] }
  | { type: 'quote'; children: MarkdownBlock[] }
  | { type: 'code'; text: string }
  | { type: 'rule' }

const INLINE = /\*\*(.+?)\*\*|\*([^\s*](?:[^*]*[^\s*])?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g

export function parseInline(text: string): Inline[] {
  const result: Inline[] = []
  let last = 0
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0
    if (index > last) result.push({ type: 'text', text: text.slice(last, index) })
    if (match[1] !== undefined) result.push({ type: 'strong', children: parseInline(match[1]) })
    else if (match[2] !== undefined) result.push({ type: 'em', children: parseInline(match[2]) })
    else if (match[3] !== undefined) result.push({ type: 'code', text: match[3] })
    else result.push({ type: 'link', label: parseInline(match[4]), href: match[5] })
    last = index + match[0].length
  }
  if (last < text.length) result.push({ type: 'text', text: text.slice(last) })
  return result
}

const HEADING = /^(#{1,4})\s+(.+?)\s*#*\s*$/
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/
const FENCE = /^\s*```/
const QUOTE = /^\s*>\s?/
const TABLE_ROW = /^\s*\|/
const TABLE_DIVIDER = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/

function indentOf(line: string): number {
  return line.length - line.trimStart().length
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function alignOf(cell: string): TableAlign {
  if (cell.startsWith(':') && cell.endsWith(':')) return 'center'
  return cell.endsWith(':') ? 'right' : 'left'
}

function startsBlock(lines: string[], index: number): boolean {
  const line = lines[index]
  return (
    HEADING.test(line) ||
    RULE.test(line) ||
    FENCE.test(line) ||
    QUOTE.test(line) ||
    LIST_ITEM.test(line) ||
    (TABLE_ROW.test(line) && TABLE_DIVIDER.test(lines[index + 1] ?? ''))
  )
}

// `offset` is the line number of lines[0] in the whole document, so heading ids match headingsOf.
function parseLines(lines: string[], offset: number): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      const level = heading[1].length
      // The document title is shown above the body, so a level-one heading is not repeated.
      if (level > 1)
        blocks.push({ type: 'heading', id: `section-${offset + index}`, level: level as 2 | 3 | 4, content: parseInline(heading[2]) })
      index += 1
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule' })
      index += 1
      continue
    }

    if (FENCE.test(line)) {
      const body: string[] = []
      index += 1
      while (index < lines.length && !FENCE.test(lines[index])) {
        body.push(lines[index])
        index += 1
      }
      blocks.push({ type: 'code', text: body.join('\n') })
      index += 1
      continue
    }

    if (QUOTE.test(line)) {
      const start = index
      const body: string[] = []
      while (index < lines.length && QUOTE.test(lines[index])) {
        body.push(lines[index].replace(QUOTE, ''))
        index += 1
      }
      blocks.push({ type: 'quote', children: parseLines(body, offset + start) })
      continue
    }

    if (TABLE_ROW.test(line) && TABLE_DIVIDER.test(lines[index + 1] ?? '')) {
      const header = cells(line)
      const align = cells(lines[index + 1]).map(alignOf)
      const rows: Inline[][][] = []
      index += 2
      while (index < lines.length && TABLE_ROW.test(lines[index])) {
        rows.push(cells(lines[index]).map(parseInline))
        index += 1
      }
      blocks.push({ type: 'table', hasHeader: header.some(Boolean), align, header: header.map(parseInline), rows })
      continue
    }

    const item = LIST_ITEM.exec(line)
    if (item) {
      const baseIndent = item[1].length
      const ordered = /\d/.test(item[2])
      const items: ListItem[] = []
      while (index < lines.length) {
        const current = LIST_ITEM.exec(lines[index])
        if (!current || current[1].length !== baseIndent || /\d/.test(current[2]) !== ordered) break
        const text = [current[3]]
        const childStart = index + 1
        const child: string[] = []
        index += 1
        // Lines indented past the marker belong to this item: wrapped text first, then nested blocks.
        while (
          index < lines.length &&
          (lines[index].trim() === '' ? indentOf(lines[index + 1] ?? '') > baseIndent : indentOf(lines[index]) > baseIndent)
        ) {
          if (child.length === 0 && lines[index].trim() && !LIST_ITEM.test(lines[index])) text.push(lines[index].trim())
          else child.push(lines[index].slice(Math.min(indentOf(lines[index]), baseIndent + 2)))
          index += 1
        }
        items.push({ content: parseInline(text.join(' ')), children: parseLines(child, childStart + (text.length - 1)) })
        if (lines[index]?.trim() === '' && LIST_ITEM.exec(lines[index + 1] ?? '')?.[1].length === baseIndent) index += 1
      }
      blocks.push({ type: 'list', ordered, start: ordered ? Number.parseInt(item[2], 10) : 1, items })
      continue
    }

    const paragraph: Inline[][] = []
    while (index < lines.length && lines[index].trim() && (paragraph.length === 0 || !startsBlock(lines, index))) {
      paragraph.push(parseInline(lines[index].trim()))
      index += 1
    }
    blocks.push({ type: 'paragraph', lines: paragraph })
  }
  return blocks
}

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  return parseLines(markdown.replace(/\r\n?/g, '\n').split('\n'), 0)
}
