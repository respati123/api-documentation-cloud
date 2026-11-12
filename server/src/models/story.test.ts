import { describe, expect, test } from 'bun:test'
import { storyStage } from '@/models/story'

describe('storyStage', () => {
  test('work statuses map straight to their stage', () => {
    expect(storyStage('in_progress', null, 0)).toBe('in_progress')
    expect(storyStage('review', null, 0)).toBe('qa')
    expect(storyStage('done', null, 0)).toBe('done')
  })

  test('an approved design moves a story past design', () => {
    expect(storyStage('ready', '2026-11-12T00:00:00Z', 1)).toBe('design_approved')
  })

  test('a story with a design or in refinement is in design, a bare draft stays draft', () => {
    expect(storyStage('draft', null, 1)).toBe('design')
    expect(storyStage('refinement', null, 0)).toBe('design')
    expect(storyStage('draft', null, 0)).toBe('draft')
  })
})
