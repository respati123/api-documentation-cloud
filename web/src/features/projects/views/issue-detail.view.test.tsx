import '@/shared/i18n'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { type IssueDetailProps, IssueDetailView } from '@/features/projects/views/issue-detail.view'

function props(over: Record<string, unknown> = {}, issueOver: Record<string, unknown> = {}): IssueDetailProps {
  return {
    open: vi.fn(),
    close: vi.fn(),
    isOpen: true,
    status: 'ready',
    error: null,
    onRetry: vi.fn(),
    actionError: null,
    issue: {
      id: 'a',
      key: 'PARI-12',
      title: 'Pay with a card',
      typeLabel: 'Story',
      description: 'As a buyer I pay.',
      acceptance: '',
      statusValue: 'ready',
      statusLabel: 'Ready',
      statusOptions: [
        { value: 'ready', label: 'Ready' },
        { value: 'done', label: 'Done' },
      ],
      canSetStatus: true,
      setStatus: vi.fn(),
      pointsValue: '5',
      pointsLabel: '5 pts',
      pointsOptions: [{ value: '5', label: '5' }],
      showPoints: true,
      canSetPoints: true,
      setPoints: vi.fn(),
      priorityLabel: 'High',
      assignee: 'rani',
      parent: { key: 'PARI-1', title: 'Payment' },
      sprintLabel: 'Not in a sprint',
      outdated: null,
      canReview: true,
      markReviewed: vi.fn(),
      ...issueOver,
    },
    childrenHeading: 'Sub-tasks',
    showChildren: true,
    children: {
      rows: [{ id: 's1', key: 'PARI-13', title: 'Build the form', typeLabel: 'Sub-task', statusLabel: 'To do', assignee: 'budi' }],
      hasMore: false,
      isLoadingMore: false,
      onLoadMore: vi.fn(),
    },
    checklist: {
      items: [
        { id: 'c1', title: 'Write the test', done: true },
        { id: 'c2', title: 'Review', done: false },
      ],
      progress: '1 of 2 done',
      canEdit: true,
      newItem: '',
      setNewItem: vi.fn(),
      canAdd: false,
      add: vi.fn(),
      toggle: vi.fn(),
      remove: vi.fn(),
    },
    links: [{ id: 'l1', label: 'Blocked by', key: 'PARI-9', title: 'Login' }],
    ...over,
  } as unknown as IssueDetailProps
}

beforeEach(async () => {
  await i18next.changeLanguage('en')
})
afterEach(cleanup)

describe('IssueDetailView', () => {
  test('shows the key, details, parent, sub-tasks, checklist, and links', () => {
    render(<IssueDetailView vm={props()} />)
    const sheet = screen.getByTestId('issue-detail')
    expect(sheet).toHaveTextContent('PARI-12')
    expect(sheet).toHaveTextContent('Pay with a card')
    expect(screen.getByTestId('issue-detail-parent')).toHaveTextContent('PARI-1')
    expect(screen.getByTestId('issue-detail-description')).toHaveTextContent('As a buyer I pay.')
    expect(within(sheet).getByText('No acceptance criteria yet.')).toBeInTheDocument()
    expect(screen.getByTestId('issue-detail-child-s1')).toHaveTextContent('PARI-13')
    expect(sheet).toHaveTextContent('1 of 2 done')
    expect(screen.getByTestId('issue-detail-link-l1')).toHaveTextContent('Blocked by')
  })

  test('opening a sub-task asks for that issue', () => {
    const vm = props()
    render(<IssueDetailView vm={vm} />)
    fireEvent.click(screen.getByTestId('issue-detail-open-s1'))
    expect(vm.open).toHaveBeenCalledWith('s1')
  })

  test('a viewer sees status and points as text, and no checklist form', () => {
    const vm = props({ checklist: { ...props().checklist, canEdit: false } }, { canSetStatus: false, canSetPoints: false })
    render(<IssueDetailView vm={vm} />)
    expect(screen.queryByTestId('issue-detail-status')).toBeNull()
    expect(screen.queryByTestId('issue-detail-points')).toBeNull()
    expect(screen.queryByTestId('issue-detail-check-new')).toBeNull()
    expect(screen.getByTestId('issue-detail-tick-c1')).toBeDisabled()
    expect(screen.queryByTestId('issue-detail-delete-c1')).toBeNull()
  })

  test('the checklist ticks, deletes, and adds an item', () => {
    const vm = props({ checklist: { ...props().checklist, canAdd: true, newItem: 'Deploy' } })
    render(<IssueDetailView vm={vm} />)
    fireEvent.click(screen.getByTestId('issue-detail-tick-c2'))
    expect(vm.checklist.toggle).toHaveBeenCalledWith('c2', true)
    fireEvent.click(screen.getByTestId('issue-detail-delete-c1'))
    expect(vm.checklist.remove).toHaveBeenCalledWith('c1')
    fireEvent.click(screen.getByTestId('issue-detail-check-add'))
    expect(vm.checklist.add).toHaveBeenCalled()
  })

  test('hides the points of an epic and the sub-tasks of a sub-task', () => {
    render(<IssueDetailView vm={props({ showChildren: false }, { showPoints: false })} />)
    expect(screen.queryByTestId('issue-detail-points')).toBeNull()
    expect(screen.queryByTestId('issue-detail-child-s1')).toBeNull()
  })

  test('the PRD warning appears, stronger in a running sprint, and the PM can clear it', () => {
    const plain = props({}, { outdated: 'plain' })
    const { rerender } = render(<IssueDetailView vm={plain} />)
    expect(screen.getByTestId('issue-detail-outdated')).toHaveTextContent('The PRD changed after this was written.')
    rerender(<IssueDetailView vm={props({}, { outdated: 'sprint' })} />)
    expect(screen.getByTestId('issue-detail-outdated')).toHaveTextContent('running sprint')
    const vm = props({}, { outdated: 'sprint' })
    rerender(<IssueDetailView vm={vm} />)
    fireEvent.click(screen.getByTestId('issue-detail-reviewed'))
    expect(vm.issue?.markReviewed).toHaveBeenCalled()
    rerender(<IssueDetailView vm={props({}, { outdated: 'sprint', canReview: false })} />)
    expect(screen.queryByTestId('issue-detail-reviewed')).toBeNull()
  })

  test('shows a loading placeholder, the server message with a retry, and the refusal of a change', () => {
    const { rerender } = render(<IssueDetailView vm={props({ status: 'loading', issue: null })} />)
    expect(screen.getByTestId('issue-detail-loading')).toBeInTheDocument()
    const failed = props({ status: 'error', issue: null, error: 'You may not read this project.' })
    rerender(<IssueDetailView vm={failed} />)
    expect(screen.getByTestId('issue-detail-error')).toHaveTextContent('You may not read this project.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(failed.onRetry).toHaveBeenCalled()
    rerender(<IssueDetailView vm={props({ actionError: 'A sub-task is not done.' })} />)
    expect(screen.getByTestId('issue-detail-action-error')).toHaveTextContent('A sub-task is not done.')
  })

  test('is not shown while closed', () => {
    render(<IssueDetailView vm={props({ isOpen: false })} />)
    expect(screen.queryByTestId('issue-detail')).toBeNull()
  })
})
