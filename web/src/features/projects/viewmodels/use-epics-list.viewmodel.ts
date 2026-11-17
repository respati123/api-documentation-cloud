import { useState } from 'react'
import { EPIC_GROUPS, type EpicFilter, type EpicRow, epicsSummary, filterEpics } from '@/features/projects/utils/epics'

export type EpicsLayout = 'list' | 'board'

// Search, filter, layout, and which epics show their stories. Epics in progress, and epics whose story matched
// the search, start open. A toggle by the user wins over that default.
export function useEpicsListViewModel(rows: EpicRow[]) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<EpicFilter>('all')
  const [layout, setLayout] = useState<EpicsLayout>('list')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const visible = filterEpics(rows, filter, query).map((row) => ({
    ...row,
    open: expanded[row.id] ?? (row.group === 'active' || row.matchedStory),
  }))

  return {
    summary: epicsSummary(rows),
    total: rows.length,
    query,
    setQuery,
    filter,
    setFilter,
    filters: [
      { id: 'all' as const, count: rows.length },
      ...EPIC_GROUPS.map((group) => ({ id: group.id, count: rows.filter((row) => row.group === group.id).length })),
    ],
    layout,
    setLayout,
    visible,
    columns: EPIC_GROUPS.map((group) => ({ id: group.id, rows: visible.filter((row) => row.group === group.id) })),
    rowOf: (id: string) => rows.find((row) => row.id === id) ?? null,
    toggle: (id: string) => {
      const current = visible.find((row) => row.id === id)?.open ?? false
      setExpanded((state) => ({ ...state, [id]: !current }))
    },
  }
}
