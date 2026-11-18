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
  pointsValue: '3',
  canSetPoints: false,
  canPublish: false,
  ...over,
})

const noop = () => {}
const closed = { open: false, onClose: noop, onSubmit: noop, isSaving: false, error: null }

function actionsStub(over: Record<string, unknown> = {}) {
  return {
    rowError: null,
    rankEnabled: false,
    sprintTargets: [{ id: 's2', name: 'Sprint 2' }],
    canStartSprint: true,
    setPoints: vi.fn(),
    publish: vi.fn(),
    move: vi.fn(),
    addToSprint: vi.fn(),
    removeFromSprint: vi.fn(),
    startSprint: vi.fn(),
    issueDialog: {
      ...closed,
      onOpen: vi.fn(),
      type: 'story',
      setType: noop,
      title: '',
      setTitle: noop,
      description: '',
      setDescription: noop,
      parentId: '',
      setParentId: noop,
      points: '',
      setPoints: noop,
      priority: 'medium',
      setPriority: noop,
      typeOptions: [{ value: 'story', label: 'Story' }],
      epicOptions: [{ value: '', label: 'No epic' }],
      pointsOptions: [
        { value: '', label: 'No points' },
        { value: '3', label: '3' },
      ],
      priorityOptions: [{ value: 'medium', label: 'Medium' }],
      takesParent: true,
      takesPoints: true,
      canSubmit: false,
    },
    sprintDialog: {
      ...closed,
      editing: false,
      onOpenCreate: vi.fn(),
      onOpenEdit: vi.fn(),
      name: '',
      setName: noop,
      goal: '',
      setGoal: noop,
      startsOn: '',
      setStartsOn: noop,
      endsOn: '',
      setEndsOn: noop,
      canSubmit: false,
    },
    closeDialog: { ...closed, name: '', onOpen: vi.fn(), carryTo: 'backlog', setCarryTo: noop, options: [] },
    overrideDialog: { ...closed, title: '', reasons: [], reason: '', setReason: noop, canSubmit: false },
    goalDialog: { ...closed, onOpen: vi.fn(), goal: '', setGoal: noop },
    ...over,
  }
}

function props(over: Partial<BacklogProps> = {}): BacklogProps {
  return {
    status: 'ready',
    error: null,
    onRetry: vi.fn(),
    productGoal: 'Halve checkout time',
    actions: actionsStub(),
    canCreate: false,
    canPlan: false,
    canEditGoal: false,
    rankEnabled: false,
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
        canStart: false,
        canClose: false,
        canEdit: false,
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

  test('hides every action from a member who may not plan', () => {
    render(<BacklogView vm={props()} />)
    expect(screen.queryByTestId('backlog-new-sprint')).toBeNull()
    expect(screen.queryByTestId('backlog-new-issue')).toBeNull()
    expect(screen.queryByTestId('backlog-edit-goal')).toBeNull()
    expect(screen.queryByTestId('backlog-menu-c')).toBeNull()
    expect(screen.queryByTestId('backlog-up-c')).toBeNull()
  })

  test('the header buttons open the sprint and issue dialogs', () => {
    const vm = props({ canPlan: true, canCreate: true, canEditGoal: true })
    render(<BacklogView vm={vm} />)
    fireEvent.click(screen.getByTestId('backlog-new-sprint'))
    fireEvent.click(screen.getByTestId('backlog-new-issue'))
    fireEvent.click(screen.getByTestId('backlog-edit-goal'))
    expect(vm.actions.sprintDialog.onOpenCreate).toHaveBeenCalled()
    expect(vm.actions.issueDialog.onOpen).toHaveBeenCalled()
    expect(vm.actions.goalDialog.onOpen).toHaveBeenCalled()
  })

  test('start, close, and edit appear only when the sprint allows them', () => {
    const vm = props()
    vm.sprints[0] = { ...vm.sprints[0], canStart: true, canClose: true, canEdit: true }
    render(<BacklogView vm={vm} />)
    fireEvent.click(screen.getByTestId('backlog-start-s1'))
    fireEvent.click(screen.getByTestId('backlog-close-s1'))
    fireEvent.click(screen.getByTestId('backlog-edit-s1'))
    expect(vm.actions.startSprint).toHaveBeenCalledWith('s1')
    expect(vm.actions.closeDialog.onOpen).toHaveBeenCalledWith('s1')
    expect(vm.actions.sprintDialog.onOpenEdit).toHaveBeenCalledWith('s1')
  })

  test('a row publishes a draft and shows its points as a selector', () => {
    const vm = props()
    vm.backlog.rows = [row('d', { isDraft: true, canPublish: true, canSetPoints: true })]
    render(<BacklogView vm={vm} />)
    fireEvent.click(screen.getByTestId('backlog-publish-d'))
    expect(vm.actions.publish).toHaveBeenCalledWith('d')
    expect(screen.getByTestId('backlog-points-d')).toBeInTheDocument()
  })

  test('moving a row names the ids of its own list, and the ends cannot move further', () => {
    const vm = props({ rankEnabled: true })
    vm.backlog.rows = [row('c1'), row('c2')]
    render(<BacklogView vm={vm} />)
    expect(screen.getByTestId('backlog-up-c1')).toBeDisabled()
    expect(screen.getByTestId('backlog-down-c2')).toBeDisabled()
    fireEvent.click(screen.getByTestId('backlog-down-c1'))
    expect(vm.actions.move).toHaveBeenCalledWith(['c1', 'c2'], 0, 'down')
  })

  test('the title opens the issue when the screen can show it, and is plain text otherwise', () => {
    const onOpen = vi.fn()
    const { rerender } = render(<BacklogView vm={props()} onOpenIssue={onOpen} />)
    fireEvent.click(screen.getByTestId('backlog-open-c'))
    expect(onOpen).toHaveBeenCalledWith('c')
    rerender(<BacklogView vm={props()} />)
    expect(screen.queryByTestId('backlog-open-c')).toBeNull()
  })

  test('every list takes drops, and a drag handle shows only when the person may order the backlog', () => {
    const { rerender } = render(<BacklogView vm={props()} />)
    expect(screen.getByTestId('backlog-list-s1')).toBeInTheDocument()
    expect(screen.getByTestId('backlog-list-backlog')).toBeInTheDocument()
    expect(screen.queryByTestId('backlog-drag-c')).toBeNull()
    rerender(<BacklogView vm={props({ rankEnabled: true })} />)
    expect(screen.getByTestId('backlog-drag-c')).toBeInTheDocument()
    expect(screen.getByTestId('backlog-drag-a')).toBeInTheDocument()
  })
})
