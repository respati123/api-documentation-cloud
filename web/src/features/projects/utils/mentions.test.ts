import { describe, expect, test } from 'vitest'
import { activeMention, bodyParts, insertMention, mentionedIds, mentionSuggestions, paragraphsOf } from '@/features/projects/utils/mentions'

const members = [
  { id: 'u-arif', email: 'arif@contoh.test' },
  { id: 'u-rina', email: 'rina@contoh.test' },
]

describe('mentions', () => {
  test('a mention is active right after "@" at the start or after a space, not inside an email', () => {
    expect(activeMention('hai @ar', 7)).toEqual({ query: 'ar', start: 4 })
    expect(activeMention('@', 1)).toEqual({ query: '', start: 0 })
    expect(activeMention('mail a@b', 8)).toBeNull()
  })

  test('picking a member replaces the query with the handle and a space', () => {
    expect(insertMention('hai @ar tolong', 4, 7, 'arif')).toEqual({ text: 'hai @arif tolong', caret: 10 })
  })

  test('suggestions match the start of the handle', () => {
    expect(mentionSuggestions(members, 'ri').map((member) => member.id)).toEqual(['u-rina'])
  })

  test('only handles still in the text count as mentions', () => {
    expect(mentionedIds('@arif cek ya, rina juga', members)).toEqual(['u-arif'])
    expect(mentionedIds('@arifin bukan arif', members)).toEqual([])
  })

  test('a blank line splits paragraphs and a mention stays inside its paragraph', () => {
    const parts = bodyParts('Halo @rina,\nmohon cek.\n\nTerima kasih @arif', members)
    expect(paragraphsOf(parts)).toEqual([
      [
        { text: 'Halo ', mention: false },
        { text: '@rina', mention: true },
        { text: ',\nmohon cek.', mention: false },
      ],
      [
        { text: 'Terima kasih ', mention: false },
        { text: '@arif', mention: true },
      ],
    ])
  })

  test('a single line stays one paragraph', () => {
    expect(paragraphsOf(bodyParts('satu baris saja', members))).toEqual([[{ text: 'satu baris saja', mention: false }]])
  })

  test('the body marks known mentions', () => {
    expect(bodyParts('tolong @rina dan @orang', members)).toEqual([
      { text: 'tolong ', mention: false },
      { text: '@rina', mention: true },
      { text: ' dan ', mention: false },
      { text: '@orang', mention: false },
    ])
  })
})
