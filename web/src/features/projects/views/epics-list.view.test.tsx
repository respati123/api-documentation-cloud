import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { countStages, type EpicRow } from '@/features/projects/utils/epics'
import { EpicsListView } from '@/features/projects/views/epics-list.view'

const epic: EpicRow & { open: boolean; matchedStory: boolean } = {
  id: 'e1',
  code: 'E-1',
  title: 'Onboarding merchant',
  summary: 'Merchant mendaftar sendiri.',
  overview: [],
  sections: [],
  status: 'in_progress',
  group: 'active',
  published: false,
  outdated: true,
  source: 'PRD Onboarding · 2. Alur',
  stories: [{ id: 's1', code: 'S-1.1', title: 'Form pendaftaran', stage: 'design', tasksDone: 1, tasksTotal: 3 }],
  storiesDone: 0,
  percent: 0,
  awaitingDesign: 1,
  stageCounts: countStages(['design']),
  team: [{ id: 'u1', name: 'rani', discipline: 'pm' }],
  open: true,
  matchedStory: false,
}

function epics(overrides = {}) {
  return {
    summary: { epics: 1, active: 1, stories: 1, storiesDone: 0, awaitingDesign: 1, stageCounts: countStages(['design']) },
    total: 1,
    query: '',
    setQuery: vi.fn(),
    filter: 'all' as const,
    setFilter: vi.fn(),
    filters: [
      { id: 'all' as const, count: 1 },
      { id: 'active' as const, count: 1 },
    ],
    layout: 'list' as const,
    setLayout: vi.fn(),
    visible: [epic],
    columns: [{ id: 'active' as const, rows: [epic] }],
    toggle: vi.fn(),
    rowOf: () => null,
    canCreate: true,
    open: vi.fn(),
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
})

describe('EpicsListView', () => {
  test('an epic card shows its progress, open stories, and task counts', () => {
    render(<EpicsListView epics={epics()} canManage onNewEpic={vi.fn()} onNewStory={vi.fn()} />)

    const card = screen.getByTestId('projects-epic-card-e1')
    expect(card).toHaveTextContent('Onboarding merchant')
    expect(card).toHaveTextContent('PRD Onboarding · 2. Alur')
    expect(screen.getByTestId('projects-story-s1')).toHaveTextContent('Form pendaftaran')
    expect(screen.getByTestId('projects-story-s1')).toHaveTextContent('1/3')
  })

  test('the title opens the epic, the arrow toggles its stories, and a story can be added to an unpublished epic', () => {
    const vm = epics()
    const onNewStory = vi.fn()
    render(<EpicsListView epics={vm} canManage onNewEpic={vi.fn()} onNewStory={onNewStory} />)

    fireEvent.click(screen.getByTestId('projects-epic-e1'))
    fireEvent.click(screen.getByTestId('projects-epic-toggle-e1'))
    fireEvent.click(screen.getByTestId('projects-epic-add-story-e1'))

    expect(vm.open).toHaveBeenCalledWith('e1')
    expect(vm.toggle).toHaveBeenCalledWith('e1')
    expect(onNewStory).toHaveBeenCalledWith('e1')
  })

  test('the filter, search, and layout controls report what was chosen', () => {
    const vm = epics()
    render(<EpicsListView epics={vm} canManage={false} onNewEpic={vi.fn()} onNewStory={vi.fn()} />)

    fireEvent.click(screen.getByTestId('projects-epics-filter-active'))
    fireEvent.change(screen.getByTestId('projects-epics-search'), { target: { value: 'kyb' } })
    fireEvent.click(screen.getByTestId('projects-epics-layout-board'))

    expect(vm.setFilter).toHaveBeenCalledWith('active')
    expect(vm.setQuery).toHaveBeenCalledWith('kyb')
    expect(vm.setLayout).toHaveBeenCalledWith('board')
    expect(screen.queryByTestId('projects-epic-add-story-e1')).toBeNull()
  })

  test('the board layout groups epics into columns', () => {
    render(<EpicsListView epics={epics({ layout: 'board' })} canManage={false} onNewEpic={vi.fn()} onNewStory={vi.fn()} />)

    expect(screen.getByTestId('projects-epics-column-active')).toHaveTextContent('Onboarding merchant')
  })

  test('a search with no result says so instead of an empty list', () => {
    render(<EpicsListView epics={epics({ visible: [] })} canManage={false} onNewEpic={vi.fn()} onNewStory={vi.fn()} />)

    expect(screen.getByTestId('projects-epics-no-match')).toBeInTheDocument()
  })
})
