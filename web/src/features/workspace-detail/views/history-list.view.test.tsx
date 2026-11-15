import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { HistoryListView, type HistoryListViewProps } from '@/features/workspace-detail/views/history-list.view'

const props: HistoryListViewProps = {
  dayGroups: [
    {
      key: '2026-11-07',
      label: 'Nov 7, 2026',
      commits: [{ id: 'c3', shortId: 'c3', message: 'Rename paths', authorEmail: 'ada@test.dev', when: 'today', isLatest: true }],
    },
    {
      key: '2026-11-03',
      label: 'Nov 3, 2026',
      commits: [{ id: 'c2', shortId: 'c2', message: 'First', authorEmail: '', when: 'last week', isLatest: false }],
    },
  ],
  commitCount: 2,
  usesBranches: false,
  hasMore: false,
  isLoadingMore: false,
  onLoadMore: vi.fn(),
  onOpenCommit: vi.fn(),
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('HistoryListView', () => {
  test('groups commits by day and marks the latest', () => {
    render(<HistoryListView {...props} />)

    expect(screen.getByTestId('history-day-2026-11-07')).toContainElement(screen.getByTestId('history-commit-c3'))
    expect(screen.getByTestId('history-commit-c3-latest')).toBeInTheDocument()
    expect(screen.queryByTestId('history-commit-c2-latest')).not.toBeInTheDocument()
  })

  test('opens a commit from its title or its arrow', () => {
    render(<HistoryListView {...props} />)

    fireEvent.click(screen.getByTestId('history-commit-c3-title'))
    fireEvent.click(screen.getByTestId('history-commit-c2-open'))

    expect(props.onOpenCommit).toHaveBeenNthCalledWith(1, 'c3')
    expect(props.onOpenCommit).toHaveBeenNthCalledWith(2, 'c2')
  })

  test('shows an empty state with no commits, and a branch note for branch workspaces', () => {
    const { rerender } = render(<HistoryListView {...props} dayGroups={[]} commitCount={0} />)
    const emptyText = screen.getByTestId('history-empty-state').textContent

    rerender(<HistoryListView {...props} usesBranches />)
    expect(screen.getByTestId('history-empty-state').textContent).not.toBe(emptyText)
  })
})
