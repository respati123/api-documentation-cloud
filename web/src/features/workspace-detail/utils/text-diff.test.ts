import { describe, expect, test } from 'vitest'
import { buildBlocks, diffLines, diffStats, toSplitRows } from '@/features/workspace-detail/utils/text-diff'

const lines = (count: number, prefix = 'line') => Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`).join('\n')

describe('diffLines', () => {
  test('numbers kept, removed, and added lines on each side', () => {
    const result = diffLines('a\nb\nc', 'a\nB\nc')

    expect(result.map((line) => [line.kind, line.oldLine, line.newLine, line.text])).toEqual([
      ['same', 1, 1, 'a'],
      ['removed', 2, null, 'b'],
      ['added', null, 2, 'B'],
      ['same', 3, 3, 'c'],
    ])
  })

  test('marks every line added when there was no earlier version', () => {
    expect(diffLines('', 'x\ny').map((line) => line.kind)).toEqual(['added', 'added'])
  })

  test('marks every line removed when the item was deleted', () => {
    expect(diffLines('x\ny', '').map((line) => line.kind)).toEqual(['removed', 'removed'])
  })

  test('highlights only the changed words of an edited line', () => {
    const [, removed, added] = diffLines('{\n  "url": "/v1/users",\n}', '{\n  "url": "/v2/users",\n}')

    expect(removed.segments.filter((segment) => segment.changed).map((segment) => segment.text)).toEqual(['v1'])
    expect(added.segments.filter((segment) => segment.changed).map((segment) => segment.text)).toEqual(['v2'])
    expect(added.segments.map((segment) => segment.text).join('')).toBe('  "url": "/v2/users",')
  })

  test('does not highlight words in a line with no partner', () => {
    const [line] = diffLines('', 'brand new')

    expect(line.segments).toEqual([{ text: 'brand new', changed: false }])
  })
})

describe('diffStats', () => {
  test('counts added and removed lines', () => {
    expect(diffStats(diffLines('a\nb\nc', 'a\nB\nC\nd'))).toEqual({ added: 3, removed: 2 })
  })
})

describe('buildBlocks', () => {
  test('keeps three lines of context around a change and folds the rest into gaps', () => {
    const before = lines(20)
    const after = before.replace('line 10', 'line ten')

    const blocks = buildBlocks(diffLines(before, after))

    expect(blocks.map((block) => block.kind)).toEqual(['gap', 'hunk', 'gap'])
    const hunk = blocks[1]
    expect(hunk.kind === 'hunk' && hunk.header).toBe('@@ -7,7 +7,7 @@')
    expect(hunk.lines.map((line) => line.text)).toEqual([
      'line 7',
      'line 8',
      'line 9',
      'line 10',
      'line ten',
      'line 11',
      'line 12',
      'line 13',
    ])
    expect(blocks[0].lines).toHaveLength(6)
    expect(blocks[2].lines).toHaveLength(7)
  })

  test('joins two changes whose context overlaps into one hunk', () => {
    const before = lines(12)
    const after = before.replace('line 4', 'four').replace('line 8', 'eight')

    const blocks = buildBlocks(diffLines(before, after))

    expect(blocks.filter((block) => block.kind === 'hunk')).toHaveLength(1)
  })

  test('gives each gap a stable id', () => {
    const before = lines(30)
    const after = before.replace('line 5', 'five').replace('line 25', 'twenty five')

    const ids = buildBlocks(diffLines(before, after))
      .filter((block) => block.kind === 'gap')
      .map((block) => block.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(buildBlocks(diffLines(before, after)).map((block) => block.id)).toEqual(
      buildBlocks(diffLines(before, after)).map((block) => block.id),
    )
  })

  test('writes the header of a new item from zero', () => {
    const [block] = buildBlocks(diffLines('', 'a\nb'))

    expect(block.kind === 'hunk' && block.header).toBe('@@ -0,0 +1,2 @@')
  })

  test('returns nothing when both sides are empty', () => {
    expect(buildBlocks(diffLines('', ''))).toEqual([])
  })
})

describe('toSplitRows', () => {
  test('puts removed lines beside the added lines that replace them', () => {
    const rows = toSplitRows(diffLines('a\nb\nc\nd', 'a\nB\nd'))

    expect(rows.map((row) => [row.left?.text ?? null, row.right?.text ?? null])).toEqual([
      ['a', 'a'],
      ['b', 'B'],
      ['c', null],
      ['d', 'd'],
    ])
  })
})
