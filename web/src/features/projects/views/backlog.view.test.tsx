import '@/shared/i18n'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { BacklogRow } from '@/features/projects/viewmodels/use-backlog.viewmodel'
import { type BacklogProps, BacklogView } from '@/features/projects/views/backlog.view'

const row = (id: string, over: Partial<BacklogRow> = {}): BacklogRow => ({
  id,
  key: `PARI-${id}`,
  title: `Item ${id}`,
  type: 'task',
  typeLabel: 'Task',
  statusLabel: 'To do',
  category: 'todo',
  points: 3,
  pointsLabel: '3 pts',
  epicKey: null,
  assignee: 'Unassigned',
  gaps: [],
  ready: true,
  isDraft: false,
  outdated: false,
  ...over,
})

function props(over: Partial<BacklogProps> = {}): BacklogProps {
  return {
    status: 'ready',
    error: null,
    onRetry: vi.fn(),
    productGoal: 'Halve checkout time',
    epics: {
      items: [{ id: 'e1', key: 'PARI-1', title: 'Payment', count: 2, selected: false }],
      withoutEpic: 1,
      total: 5,
      selected: '',
      hasMore: false,
      isLoadingMore: false,
      onLoadMore: vi.fn(),
      onSelect: vi.fn(),
    },
    sprints: [
      {
        id: 's1',
        name: 'Sprint 1',
        goal: 'Ship checkout',
        isActive: true,
        statusLabel: 'Active',
        dates: '1 Jul 2026 to 15 Jul 2026',
        daysLeft: '5 days left',
        totals: '2 items, 8 points',
        progress: '1 done, 5 points done',
        rows: [row('a', { category: 'done', pointsLabel: '5 pts' }), row('b', { epicKey: 'PARI-1', assignee: 'rani' })],
        emptyLabel: 'No items in this sprint yet.',
      },
    ],
    backlog: {
      rows: [row('c', { points: null, pointsLabel: 'No points', ready: false, gaps: [{ id: 'points', label: 'Needs points' }] })],
      count: '1 items',
      emptyLabel: 'The backlog is empty.',
      hasMore: false,
      isLoadingMore: false,
      onLoadMore: vi.fn(),
    },
    ...over,
  } as BacklogProps
}

beforeEach(async () => {
  await i18next.changeLanguage('en')
})
afterEach(cleanup)

describe('BacklogView', () => {
  test('shows each sprint with its dates, goal, totals, and items', () => {
    render(<BacklogView vm={props()} />)
    const sprint = screen.getByTestId('backlog-sprint-s1')
    expect(within(sprint).getByText('Sprint 1')).toBeInTheDocument()
    expect(within(sprint).getByText(/Active · 1 Jul 2026 to 15 Jul 2026/)).toBeInTheDocument()
    expect(within(sprint).getByText('5 days left')).toBeInTheDocument()
    expect(within(sprint).getByText('2 items, 8 points')).toBeInTheDocument()
    expect(within(sprint).getByText(/Ship checkout/)).toBeInTheDocument()
    expect(within(sprint).getByText(/1 done, 5 points done/)).toBeInTheDocument()
    expect(within(sprint).getByTestId('backlog-row-a')).toHaveTextContent('PARI-a')
    expect(within(sprint).getByTestId('backlog-row-b')).toHaveTextContent('PARI-1')
    expect(within(sprint).getByTestId('backlog-row-b')).toHaveTextContent('rani')
  })

  test('shows the loose items with their points and what stops them entering a sprint', () => {
    render(<BacklogView vm={props()} />)
    const item = screen.getByTestId('backlog-row-c')
    expect(item).toHaveTextContent('No points')
    expect(item).toHaveTextContent('Needs points')
    expect(within(screen.getByTestId('backlog-row-b')).getByText('Ready for a sprint')).toBeInTheDocument()
  })

  test('marks drafts and items whose PRD changed', () => {
    const vm = props({ backlog: { ...props().backlog, rows: [row('d', { isDraft: true, outdated: true })] } })
    render(<BacklogView vm={vm} />)
    expect(screen.getByTestId('backlog-row-d')).toHaveTextContent('Draft')
    expect(screen.getByTestId('backlog-row-d')).toHaveTextContent('PRD changed')
  })

  test('shows the Product Goal, or says there is none', () => {
    const { rerender } = render(<BacklogView vm={props()} />)
    expect(within(screen.getByTestId('backlog-goal')).getByText('Halve checkout time')).toBeInTheDocument()
    rerender(<BacklogView vm={props({ productGoal: '' })} />)
    expect(within(screen.getByTestId('backlog-goal')).getByText('No Product Goal yet.')).toBeInTheDocument()
  })

  test('the epic list filters, and each entry reports its count', () => {
    const vm = props()
    render(<BacklogView vm={vm} />)
    expect(screen.getByTestId('backlog-epic-all')).toHaveTextContent('5')
    expect(screen.getByTestId('backlog-epic-all')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('backlog-epic-e1')).toHaveTextContent('Payment')
    expect(screen.getByTestId('backlog-epic-e1')).toHaveTextContent('2')
    fireEvent.click(screen.getByTestId('backlog-epic-e1'))
    expect(vm.epics.onSelect).toHaveBeenCalledWith('e1')
    fireEvent.click(screen.getByTestId('backlog-epic-none'))
    expect(vm.epics.onSelect).toHaveBeenCalledWith('none')
    fireEvent.click(screen.getByTestId('backlog-epic-all'))
    expect(vm.epics.onSelect).toHaveBeenCalledWith('')
  })

  test('a selected epic is shown as pressed', () => {
    const vm = props()
    vm.epics.items[0].selected = true
    vm.epics.selected = 'e1'
    render(<BacklogView vm={vm} />)
    expect(screen.getByTestId('backlog-epic-e1')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('backlog-epic-all')).toHaveAttribute('aria-pressed', 'false')
  })

  test('says so when a sprint or the backlog has nothing in it', () => {
    const vm = props()
    vm.sprints[0].rows = []
    vm.backlog.rows = []
    render(<BacklogView vm={vm} />)
    expect(screen.getByText('No items in this sprint yet.')).toBeInTheDocument()
    expect(screen.getByText('The backlog is empty.')).toBeInTheDocument()
  })

  test('offers more loose items only when there are more', () => {
    const vm = props()
    const { rerender } = render(<BacklogView vm={vm} />)
    expect(screen.queryByTestId('backlog-load-more')).toBeNull()
    vm.backlog.hasMore = true
    rerender(<BacklogView vm={{ ...vm }} />)
    fireEvent.click(screen.getByTestId('backlog-load-more'))
    expect(vm.backlog.onLoadMore).toHaveBeenCalled()
  })

  test('shows a loading placeholder, and the message of the server with a retry', () => {
    const { rerender } = render(<BacklogView vm={props({ status: 'loading' })} />)
    expect(screen.getByTestId('backlog-loading')).toBeInTheDocument()
    const vm = props({ status: 'error', error: 'You may not read this project.' })
    rerender(<BacklogView vm={vm} />)
    expect(screen.getByTestId('backlog-error')).toHaveTextContent('You may not read this project.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(vm.onRetry).toHaveBeenCalled()
  })
})
