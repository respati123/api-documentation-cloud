import { describe, expect, test } from 'vitest'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import { navLabelKey } from '@/features/projects/utils/section-nav'

describe('navLabelKey', () => {
  test('the agile screens name the tabs Overview, Discovery, and Board', () => {
    expect(navLabelKey('flow', true)).toBe(PLANNING_TEXT.nav.overview)
    expect(navLabelKey('documents', true)).toBe(PLANNING_TEXT.nav.discovery)
    expect(navLabelKey('board', true)).toBe(PLANNING_TEXT.nav.agileBoard)
  })

  test('the other tabs keep their own names with the agile screens', () => {
    expect(navLabelKey('backlog', true)).toBe(PLANNING_TEXT.nav.backlog)
    expect(navLabelKey('reports', true)).toBe(PLANNING_TEXT.nav.reports)
  })

  test('the old screens keep every old name', () => {
    expect(navLabelKey('flow', false)).toBe(PLANNING_TEXT.nav.flow)
    expect(navLabelKey('documents', false)).toBe(PLANNING_TEXT.nav.documents)
    expect(navLabelKey('epics', false)).toBe(PLANNING_TEXT.nav.epics)
    expect(navLabelKey('board', false)).toBe(PLANNING_TEXT.nav.board)
  })
})
