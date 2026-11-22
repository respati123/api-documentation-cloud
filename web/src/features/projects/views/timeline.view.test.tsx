import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { type TimelineProps, TimelineView } from '@/features/projects/views/timeline.view'

function props(over: Partial<TimelineProps> = {}): TimelineProps {
  return {
    status: 'ready',
    error: null,
    onRetry: vi.fn(),
    columns: [
      { id: 's1', name: 'Sprint 14', dates: '1 Dec – 12 Dec', active: true },
      { id: 's2', name: 'Sprint 15', dates: '15 Dec – 26 Dec', active: false },
    ],
    rows: [
      {
        id: 'e1',
        code: 'AUTH-001',
        title: 'Sign in',
        category: 'in_progress',
        categoryLabel: 'In progress',
        progress: '1 of 2 tickets done',
        span: { left: '0%', width: '100%' },
        open: true,
        toggleLabel: 'Close AUTH-001',
        onToggle: vi.fn(),
        items: [
          {
            id: 't1',
            code: 'AUTH-001-BE-1',
            title: 'Register',
            category: 'done',
            categoryLabel: 'Done',
            span: { left: '0%', width: '50%' },
          },
          { id: 't2', code: 'AUTH-001-FE-1', title: 'Screens', category: 'todo', categoryLabel: 'To do', span: null },
        ],
      },
    ],
    more: { hasMore: false, isLoadingMore: false, onLoadMore: vi.fn() },
    ...over,
  }
}

beforeEach(async () => {
  await i18next.changeLanguage('en')
})
afterEach(cleanup)

describe('TimelineView', () => {
  test('shows the sprints across, the epic with its progress, and each ticket bar or that it has no sprint', () => {
    render(<TimelineView vm={props()} />)
    expect(screen.getByTestId('timeline-sprint-s1')).toHaveTextContent('Sprint 14')
    expect(screen.getByTestId('timeline-sprint-s1')).toHaveTextContent('Active')
    expect(screen.getByTestId('timeline-epic-e1')).toHaveTextContent('AUTH-001')
    expect(screen.getByTestId('timeline-epic-e1')).toHaveTextContent('1 of 2 tickets done')
    expect(screen.getByTestId('timeline-bar-t1')).toHaveStyle({ left: '0%', width: '50%' })
    expect(screen.getByTestId('timeline-bar-t2')).toHaveTextContent('Not in a sprint yet')
  })

  test('the toggle opens and closes an epic', () => {
    const vm = props()
    render(<TimelineView vm={vm} />)
    fireEvent.click(screen.getByTestId('timeline-toggle-e1'))
    expect(vm.rows[0].onToggle).toHaveBeenCalled()
    expect(screen.getByTestId('timeline-toggle-e1')).toHaveAttribute('aria-expanded', 'true')
  })

  test('a closed epic hides its tickets, and an empty project says so', () => {
    const closed = props()
    closed.rows[0] = { ...closed.rows[0], open: false }
    const { rerender } = render(<TimelineView vm={closed} />)
    expect(screen.queryByTestId('timeline-item-t1')).toBeNull()
    rerender(<TimelineView vm={props({ rows: [] })} />)
    expect(screen.getByTestId('timeline-empty')).toHaveTextContent('The timeline is empty')
  })
})
