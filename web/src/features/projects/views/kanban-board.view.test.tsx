import '@/shared/i18n'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { type KanbanBoardProps, KanbanBoardView } from '@/features/projects/views/kanban-board.view'

const card = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  key: `PARI-${id}`,
  title: `Card ${id}`,
  typeLabel: 'Task',
  statusValue: 'todo',
  statusLabel: 'To do',
  statusOptions: [{ value: 'todo', label: 'To do' }],
  assignee: 'rani',
  points: null,
  canMove: false,
  ...over,
})

const column = (status: string, label: string, cards: unknown[], over: Record<string, unknown> = {}) => ({
  status,
  label,
  count: cards.length,
  limitLabel: String(cards.length),
  over: false,
  canSetLimit: false,
  cards,
  ...over,
})

function props(over: Partial<KanbanBoardProps> = {}): KanbanBoardProps {
  return {
    status: 'ready',
    error: null,
    onRetry: vi.fn(),
    columns: [
      column('todo', 'To do', [card('a')]),
      column('in_progress', 'In progress', [card('b'), card('c')], { limitLabel: '2 / 1', over: true, canSetLimit: true }),
    ],
    hasMore: false,
    isLoadingMore: false,
    onLoadMore: vi.fn(),
    filtering: false,
    search: '',
    setSearch: vi.fn(),
    mine: false,
    toggleMine: vi.fn(),
    moveError: null,
    move: vi.fn(),
    limitDialog: {
      open: false,
      title: 'Limit for In progress',
      value: '',
      setValue: vi.fn(),
      canSubmit: false,
      isSaving: false,
      error: null,
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onSubmit: vi.fn(),
      onClear: vi.fn(),
    },
    ...over,
  } as KanbanBoardProps
}

beforeEach(async () => {
  await i18next.changeLanguage('en')
})
afterEach(cleanup)

describe('KanbanBoardView', () => {
  test('shows a column for each status with its cards and its count against the limit', () => {
    render(<KanbanBoardView vm={props()} />)
    expect(within(screen.getByTestId('kanban-column-todo')).getByTestId('sprint-board-card-a')).toBeInTheDocument()
    expect(screen.getByTestId('kanban-count-in_progress')).toHaveTextContent('2 / 1')
    expect(screen.getByTestId('kanban-count-todo')).toHaveTextContent('1')
  })

  test('warns on a column over its limit and not on the others', () => {
    render(<KanbanBoardView vm={props()} />)
    expect(within(screen.getByTestId('kanban-column-in_progress')).getByText('Over the limit')).toBeInTheDocument()
    expect(within(screen.getByTestId('kanban-column-todo')).queryByText('Over the limit')).toBeNull()
  })

  test('the limit button shows only where the person may set a limit, and opens the dialog', () => {
    const vm = props()
    render(<KanbanBoardView vm={vm} />)
    expect(screen.queryByTestId('kanban-limit-todo')).toBeNull()
    fireEvent.click(screen.getByTestId('kanban-limit-in_progress'))
    expect(vm.limitDialog.onOpen).toHaveBeenCalledWith('in_progress')
  })

  test('the limit dialog saves, clears, and shows a refusal', () => {
    const vm = props()
    vm.limitDialog = { ...vm.limitDialog, open: true, value: '3', canSubmit: true, error: 'Only the PM may set a limit.' }
    render(<KanbanBoardView vm={vm} />)
    expect(screen.getByTestId('kanban-limit-dialog')).toHaveTextContent('Limit for In progress')
    expect(screen.getByTestId('kanban-limit-error')).toHaveTextContent('Only the PM may set a limit.')
    fireEvent.change(screen.getByTestId('kanban-limit-value'), { target: { value: '4' } })
    expect(vm.limitDialog.setValue).toHaveBeenCalledWith('4')
    fireEvent.click(screen.getByTestId('kanban-limit-save'))
    expect(vm.limitDialog.onSubmit).toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('kanban-limit-clear'))
    expect(vm.limitDialog.onClear).toHaveBeenCalled()
  })

  test('says so when there is no open work, but not when the filters hide it', () => {
    const empty = [column('todo', 'To do', []), column('in_progress', 'In progress', [])]
    const { rerender } = render(<KanbanBoardView vm={props({ columns: empty } as Partial<KanbanBoardProps>)} />)
    expect(screen.getByTestId('kanban-board-empty')).toBeInTheDocument()
    rerender(<KanbanBoardView vm={props({ columns: empty, filtering: true } as Partial<KanbanBoardProps>)} />)
    expect(screen.queryByTestId('kanban-board-empty')).toBeNull()
  })

  test('the filters report what the person does, and a card title opens the issue', () => {
    const vm = props()
    const onOpen = vi.fn()
    render(<KanbanBoardView vm={vm} onOpenIssue={onOpen} />)
    fireEvent.change(screen.getByTestId('kanban-board-search'), { target: { value: 'cart' } })
    expect(vm.setSearch).toHaveBeenCalledWith('cart')
    fireEvent.click(screen.getByTestId('kanban-board-mine'))
    expect(vm.toggleMine).toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('sprint-board-open-a'))
    expect(onOpen).toHaveBeenCalledWith('a')
  })

  test('offers more items only when there are more', () => {
    const vm = props()
    const { rerender } = render(<KanbanBoardView vm={vm} />)
    expect(screen.queryByTestId('kanban-board-more')).toBeNull()
    rerender(<KanbanBoardView vm={props({ hasMore: true })} />)
    expect(screen.getByTestId('kanban-board-more')).toBeInTheDocument()
  })

  test('shows a placeholder while loading, the server message with a retry, and a refused move', () => {
    const { rerender } = render(<KanbanBoardView vm={props({ status: 'loading' })} />)
    expect(screen.getByTestId('kanban-board-loading')).toBeInTheDocument()
    const failed = props({ status: 'error', error: 'You may not read this project.' })
    rerender(<KanbanBoardView vm={failed} />)
    expect(screen.getByTestId('kanban-board-error')).toHaveTextContent('You may not read this project.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(failed.onRetry).toHaveBeenCalled()
    rerender(<KanbanBoardView vm={props({ moveError: 'A sub-task is not done.' })} />)
    expect(screen.getByTestId('kanban-board-move-error')).toHaveTextContent('A sub-task is not done.')
  })
})
