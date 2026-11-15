import { act, renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { countStages, type EpicRow } from '@/features/projects/utils/epics'
import { useEpicsListViewModel } from '@/features/projects/viewmodels/use-epics-list.viewmodel'

function row(overrides: Partial<EpicRow>): EpicRow {
  return {
    id: 'e',
    code: 'E-1',
    title: 'Epic',
    summary: '',
    overview: [],
    sections: [],
    status: 'draft',
    group: 'planning',
    published: false,
    outdated: false,
    source: null,
    stories: [],
    storiesDone: 0,
    percent: 0,
    awaitingDesign: 0,
    stageCounts: countStages([]),
    team: [],
    ...overrides,
  }
}

const rows = [
  row({ id: 'e1', title: 'Onboarding', status: 'in_progress', group: 'active' }),
  row({
    id: 'e2',
    title: 'Refund',
    status: 'draft',
    stories: [{ id: 's1', code: 'S-2.1', title: 'Refund sebagian', stage: 'draft', tasksDone: 0, tasksTotal: 0 }],
  }),
]

describe('useEpicsListViewModel', () => {
  test('epics in progress start open, others closed, and a toggle flips one', () => {
    const { result } = renderHook(() => useEpicsListViewModel(rows))
    expect(result.current.visible.map((epic) => epic.open)).toEqual([true, false])

    act(() => result.current.toggle('e1'))
    expect(result.current.visible[0]?.open).toBe(false)
  })

  test('a search that hits a story opens its epic', () => {
    const { result } = renderHook(() => useEpicsListViewModel(rows))

    act(() => result.current.setQuery('sebagian'))

    expect(result.current.visible.map((epic) => [epic.id, epic.open])).toEqual([['e2', true]])
  })

  test('filter counts and board columns follow the epic groups', () => {
    const { result } = renderHook(() => useEpicsListViewModel(rows))

    expect(result.current.filters).toEqual([
      { id: 'all', count: 2 },
      { id: 'planning', count: 1 },
      { id: 'ready', count: 0 },
      { id: 'active', count: 1 },
      { id: 'done', count: 0 },
    ])
    expect(result.current.columns.map((column) => column.rows.map((epic) => epic.id))).toEqual([['e2'], [], ['e1'], []])
  })
})
