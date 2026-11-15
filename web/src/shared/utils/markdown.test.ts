import { describe, expect, test } from 'vitest'
import { parseInline, parseMarkdown } from '@/shared/utils/markdown'

describe('parseInline', () => {
  test('reads bold, italic, code, and links, and keeps the rest as text', () => {
    expect(parseInline('a **bold** and *soft* `code` [docs](https://x.test) end')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'strong', children: [{ type: 'text', text: 'bold' }] },
      { type: 'text', text: ' and ' },
      { type: 'em', children: [{ type: 'text', text: 'soft' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'code' },
      { type: 'text', text: ' ' },
      { type: 'link', label: [{ type: 'text', text: 'docs' }], href: 'https://x.test' },
      { type: 'text', text: ' end' },
    ])
  })

  test('leaves snake_case, lone asterisks, and math alone', () => {
    expect(parseInline('user_id * 2 ≤ 25')).toEqual([{ type: 'text', text: 'user_id * 2 ≤ 25' }])
  })
})

describe('parseMarkdown', () => {
  test('headings get the same ids as the table of contents, and the title line is dropped', () => {
    const blocks = parseMarkdown('# Title\nIntro\n## Goals\n### Detail')

    expect(blocks.map((block) => block.type)).toEqual(['paragraph', 'heading', 'heading'])
    expect(blocks[1]).toMatchObject({ type: 'heading', id: 'section-2', level: 2 })
    expect(blocks[2]).toMatchObject({ type: 'heading', id: 'section-3', level: 3 })
  })

  test('a paragraph keeps its line breaks and ends at a blank line', () => {
    const blocks = parseMarkdown('one\ntwo\n\nthree')

    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ type: 'paragraph', lines: [[{ type: 'text', text: 'one' }], [{ type: 'text', text: 'two' }]] })
  })

  test('reads bullet and numbered lists, with the start number and nested items', () => {
    const [bullets, numbers] = parseMarkdown('- a\n- b\n  - b1\n\n3. c\n4. d')

    expect(bullets).toMatchObject({ type: 'list', ordered: false })
    expect(bullets.type === 'list' && bullets.items.map((item) => item.content)).toEqual([
      [{ type: 'text', text: 'a' }],
      [{ type: 'text', text: 'b' }],
    ])
    expect(bullets.type === 'list' && bullets.items[1].children).toMatchObject([
      { type: 'list', ordered: false, items: [{ content: [{ type: 'text', text: 'b1' }] }] },
    ])
    expect(numbers).toMatchObject({ type: 'list', ordered: true, start: 3 })
  })

  test('reads a table with alignment, and marks a table whose header is empty', () => {
    const [table, keyValue] = parseMarkdown('| Name | Target |\n|---|---:|\n| Wait | ≤ 25 |\n\n| | |\n|---|---|\n| Owner | Ops |')

    expect(table).toMatchObject({ type: 'table', hasHeader: true, align: ['left', 'right'] })
    expect(table.type === 'table' && table.rows).toEqual([[[{ type: 'text', text: 'Wait' }], [{ type: 'text', text: '≤ 25' }]]])
    expect(keyValue).toMatchObject({ type: 'table', hasHeader: false })
  })

  test('reads quotes, code fences, and rules', () => {
    const blocks = parseMarkdown('> note\n\n```ts\nconst a = 1\n```\n\n---')

    expect(blocks.map((block) => block.type)).toEqual(['quote', 'code', 'rule'])
    expect(blocks[1]).toMatchObject({ type: 'code', text: 'const a = 1' })
  })

  test('plain text without markdown stays readable as paragraphs', () => {
    expect(parseMarkdown('Line one\nLine two').map((block) => block.type)).toEqual(['paragraph'])
    expect(parseMarkdown('')).toEqual([])
  })
})
