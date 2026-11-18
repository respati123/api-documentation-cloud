import { describe, expect, test } from 'bun:test'
import { outlineFromMarkdown } from '@/models/prd-outline'

describe('outlineFromMarkdown', () => {
  test('a level-2 heading is an epic and a level-3 heading under it is a story', () => {
    const outline = outlineFromMarkdown(
      ['# Checkout PRD', '', '## Payment', 'Pay by card.', '', '### Pay with a card', 'The buyer enters a card.', '', '### Pay with a wallet', '', '## Delivery', 'Ship it.'].join('\n'),
      'Checkout PRD',
    )
    expect(outline).toEqual([
      {
        title: 'Payment',
        description: 'Pay by card.',
        sourceSection: 'Payment',
        stories: [
          { title: 'Pay with a card', description: 'The buyer enters a card.', acceptanceCriteria: '', sourceSection: 'Pay with a card' },
          { title: 'Pay with a wallet', description: '', acceptanceCriteria: '', sourceSection: 'Pay with a wallet' },
        ],
      },
      { title: 'Delivery', description: 'Ship it.', sourceSection: 'Delivery', stories: [] },
    ])
  })

  test('the text after an acceptance criteria line is the acceptance criteria of the story', () => {
    const [epic] = outlineFromMarkdown(['## Epic', '### Story', 'Do the thing.', '', '**Acceptance criteria**', '- it works', '- it is fast'].join('\n'), 'PRD')
    expect(epic.stories[0]).toMatchObject({ description: 'Do the thing.', acceptanceCriteria: '- it works\n- it is fast' })
  })

  test('a story before any epic goes under an epic named after the document', () => {
    const outline = outlineFromMarkdown(['### Loose story', 'Text', '## Real epic'].join('\n'), 'My PRD')
    expect(outline.map((epic) => [epic.title, epic.stories.map((story) => story.title)])).toEqual([
      ['My PRD', ['Loose story']],
      ['Real epic', []],
    ])
  })

  test('headings inside a code fence are text, and a level-1 heading is ignored', () => {
    const outline = outlineFromMarkdown(['# Title', '## Epic', '```', '## not an epic', '### not a story', '```', 'after'].join('\n'), 'PRD')
    expect(outline).toHaveLength(1)
    expect(outline[0].stories).toEqual([])
    expect(outline[0].description).toContain('## not an epic')
  })

  test('a title longer than 180 characters is cut, and the section keeps the full heading', () => {
    const long = 'x'.repeat(200)
    const [epic] = outlineFromMarkdown(`## ${long}`, 'PRD')
    expect(epic.title).toHaveLength(180)
    expect(epic.sourceSection).toBe(long)
  })

  test('a document with no level-2 or level-3 heading has no outline', () => {
    expect(outlineFromMarkdown('# Only a title\n\nSome text.', 'PRD')).toEqual([])
    expect(outlineFromMarkdown('', 'PRD')).toEqual([])
  })
})
