import '@/shared/i18n'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { type SprintBoardProps, SprintBoardView } from '@/features/projects/views/sprint-board.view'

const card = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  key: `PARI-${id}`,
  title: `Card ${id}`,
  typeLabel: 'Sub-task',
  statusValue: 'todo',
  statusLabel: 'To do',
  statusOptions: [
    { value: 'todo', label: 'To do' },
    { value: 'done', label: 'Done' },
  ],
  assignee: 'rani',
  points: null,
  canMove: false,
  ...over,
})

function props(over: Partial<SprintBoardProps> = {}): SprintBoardProps {
  return {
    status: 'ready',
    error: null,
    onRetry: vi.fn(),
    sprint: {
      name: 'Sprint 1',
      goal: 'Ship checkout',
      dates: '1 Jul 2026 to 15 Jul 2026',
      daysLeft: '5 days left',
      totals: '1 done, 5 points done',
    },
    filtering: false,
    group: 'item',
    setGroup: vi.fn(),
    groupOptions: [
      { value: 'item', label: 'Item' },
      { value: 'epic', label: 'Epic' },
    ],
    search: '',
    setSearch: vi.fn(),
    mine: false,
    toggleMine: vi.fn(),
    lanes: [
      {
        id: 'st',
        lead: { key: 'PARI-st', title: 'Checkout', typeLabel: 'Story' },
        title: 'Checkout',
        progress: '1 of 2 done',
        percent: 50,
        columns: [
          { id: 'todo', label: 'To do', cards: [card('a')] },
          { id: 'in_progress', label: 'In progress', cards: [] },
          { id: 'done', label: 'Done', cards: [card('b', { statusValue: 'done', statusLabel: 'Done' })] },
        ],
      },
    ],
    moveError: null,
    move: vi.fn(),
    ...over,
  } as SprintBoardProps
}

beforeEach(async () => {
  await i18next.changeLanguage('en')
})
afterEach(cleanup)

describe('SprintBoardView', () => {
  test('shows the sprint, its lane, and the cards in their columns', () => {
    render(<SprintBoardView vm={props()} onOpenBacklog={vi.fn()} />)
    expect(screen.getByText('Sprint 1')).toBeInTheDocument()
    expect(screen.getByText('5 days left')).toBeInTheDocument()
    const lane = screen.getByTestId('sprint-board-lane-st')
    expect(lane).toHaveTextContent('PARI-st')
    expect(lane).toHaveTextContent('1 of 2 done')
    expect(within(screen.getByTestId('sprint-board-st-todo')).getByTestId('sprint-board-card-a')).toHaveTextContent('Card a')
    expect(within(screen.getByTestId('sprint-board-st-in_progress')).getByText('Nothing here')).toBeInTheDocument()
    expect(within(screen.getByTestId('sprint-board-st-done')).getByTestId('sprint-board-card-b')).toBeInTheDocument()
  })

  test('with no active sprint it says so and links to the backlog', () => {
    const onOpenBacklog = vi.fn()
    render(<SprintBoardView vm={props({ sprint: null })} onOpenBacklog={onOpenBacklog} />)
    expect(screen.getByTestId('sprint-board-empty')).toHaveTextContent('No active sprint')
    fireEvent.click(screen.getByTestId('sprint-board-open-backlog'))
    expect(onOpenBacklog).toHaveBeenCalled()
  })

  test('shows a placeholder while loading, and the server message with a retry', () => {
    const { rerender } = render(<SprintBoardView vm={props({ status: 'loading' })} onOpenBacklog={vi.fn()} />)
    expect(screen.getByTestId('sprint-board-loading')).toBeInTheDocument()
    const vm = props({ status: 'error', error: 'You may not read this project.' })
    rerender(<SprintBoardView vm={vm} onOpenBacklog={vi.fn()} />)
    expect(screen.getByTestId('sprint-board-error')).toHaveTextContent('You may not read this project.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(vm.onRetry).toHaveBeenCalled()
  })

  test('the filters report what the person does', () => {
    const vm = props()
    render(<SprintBoardView vm={vm} onOpenBacklog={vi.fn()} />)
    fireEvent.change(screen.getByTestId('sprint-board-search'), { target: { value: 'cart' } })
    expect(vm.setSearch).toHaveBeenCalledWith('cart')
    fireEvent.click(screen.getByTestId('sprint-board-mine'))
    expect(vm.toggleMine).toHaveBeenCalled()
    expect(screen.getByTestId('sprint-board-mine')).toHaveAttribute('aria-pressed', 'false')
  })

  test('says so when the filters leave no card, and when the sprint has no item', () => {
    const { rerender } = render(<SprintBoardView vm={props({ lanes: [], filtering: true })} onOpenBacklog={vi.fn()} />)
    expect(screen.getByTestId('sprint-board-no-match')).toHaveTextContent('No card matches these filters.')
    rerender(<SprintBoardView vm={props({ lanes: [], filtering: false })} onOpenBacklog={vi.fn()} />)
    expect(screen.getByTestId('sprint-board-no-match')).toHaveTextContent('No items in this sprint yet.')
  })

  test('an editor sees a status selector, anyone else a plain badge', () => {
    const vm = props()
    vm.lanes[0].columns[0].cards = [card('a', { canMove: true }), card('z')]
    render(<SprintBoardView vm={vm} onOpenBacklog={vi.fn()} />)
    expect(screen.getByTestId('sprint-board-status-a')).toBeInTheDocument()
    expect(screen.queryByTestId('sprint-board-status-z')).toBeNull()
    expect(within(screen.getByTestId('sprint-board-card-z')).getByText('To do')).toBeInTheDocument()
  })

  test('shows the refusal of a move above the lanes', () => {
    render(<SprintBoardView vm={props({ moveError: 'A sub-task is not done.' })} onOpenBacklog={vi.fn()} />)
    expect(screen.getByTestId('sprint-board-move-error')).toHaveTextContent('A sub-task is not done.')
  })

  test('the title of a card opens the issue when the screen can show it', () => {
    const onOpenIssue = vi.fn()
    const { rerender } = render(<SprintBoardView vm={props()} onOpenBacklog={vi.fn()} onOpenIssue={onOpenIssue} />)
    fireEvent.click(screen.getByTestId('sprint-board-open-a'))
    expect(onOpenIssue).toHaveBeenCalledWith('a')
    rerender(<SprintBoardView vm={props()} onOpenBacklog={vi.fn()} />)
    expect(screen.queryByTestId('sprint-board-open-a')).toBeNull()
  })
})
