import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '@/shared/i18n'
import { useAuthSessionStore } from '@/features/auth'
import { issuesService } from '@/features/projects/services/issues.service'
import { type BacklogAccess, useBacklogActionsViewModel } from '@/features/projects/viewmodels/use-backlog-actions.viewmodel'
import { ApiError } from '@/shared/services/api-client'

vi.mock('@/features/projects/services/issues.service', () => ({
  issuesService: {
    create: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(),
    rank: vi.fn(),
    addSprintItem: vi.fn(),
    removeSprintItem: vi.fn(),
    startSprint: vi.fn(),
    closeSprint: vi.fn(),
    createSprint: vi.fn(),
    updateSprint: vi.fn(),
    updateSettings: vi.fn(),
  },
}))

const service = vi.mocked(issuesService)
const PM: BacklogAccess = { canEdit: true, canApprove: true, canManage: true }
const LEAD: BacklogAccess = { canEdit: true, canApprove: true, canManage: false }
const MEMBER: BacklogAccess = { canEdit: true, canApprove: false, canManage: false }

const sprints = [
  { id: 's1', name: 'Sprint 1', status: 'active' as const, goal: 'Ship it', startsOn: '2026-07-01', endsOn: '2026-07-15' },
  { id: 's2', name: 'Sprint 2', status: 'planned' as const, goal: '', startsOn: '2026-07-16', endsOn: '2026-07-30' },
  { id: 's3', name: 'Sprint 3', status: 'planned' as const, goal: '', startsOn: '2026-07-31', endsOn: '2026-08-14' },
]

let client: QueryClient
const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

function setup(access: BacklogAccess = PM) {
  return renderHook(
    () =>
      useBacklogActionsViewModel({
        workspaceId: 'w1',
        projectId: 'p1',
        access,
        epics: [{ id: 'e1', title: 'Payment' }],
        openSprints: sprints,
        productGoal: 'Halve checkout time',
      }),
    { wrapper: Wrapper },
  )
}

beforeEach(async () => {
  await i18next.changeLanguage('en')
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  useAuthSessionStore.setState({ signedIn: true, userId: 'me', token: 't' })
})
afterEach(() => {
  vi.resetAllMocks()
})

describe('a new issue', () => {
  test('is made from the dialog with its parent, points, and priority, and the dialog closes', async () => {
    service.create.mockResolvedValue({} as never)
    const { result } = setup()
    act(() => result.current.issueDialog.onOpen())
    expect(result.current.issueDialog).toMatchObject({ open: true, type: 'story', canSubmit: false })
    act(() => {
      result.current.issueDialog.setTitle('  Pay with a card ')
      result.current.issueDialog.setParentId('e1')
      result.current.issueDialog.setPoints('5')
      result.current.issueDialog.setPriority('high')
    })
    expect(result.current.issueDialog.canSubmit).toBe(true)
    act(() => result.current.issueDialog.onSubmit())
    await waitFor(() => expect(result.current.issueDialog.open).toBe(false))
    expect(service.create).toHaveBeenCalledWith('t', 'w1', 'p1', {
      type: 'story',
      title: 'Pay with a card',
      description: '',
      parentId: 'e1',
      points: 5,
      priority: 'high',
    })
  })

  test('an epic has no parent and no points, whatever was picked before', async () => {
    service.create.mockResolvedValue({} as never)
    const { result } = setup()
    act(() => result.current.issueDialog.onOpen())
    act(() => {
      result.current.issueDialog.setParentId('e1')
      result.current.issueDialog.setPoints('8')
      result.current.issueDialog.setType('epic')
      result.current.issueDialog.setTitle('Payment')
    })
    expect(result.current.issueDialog).toMatchObject({ takesParent: false, takesPoints: false })
    act(() => result.current.issueDialog.onSubmit())
    await waitFor(() => expect(service.create).toHaveBeenCalled())
    expect(service.create.mock.calls[0][3]).toMatchObject({ type: 'epic', parentId: null, points: null })
  })

  test('a member who may not plan can only file a bug', () => {
    const { result } = setup(MEMBER)
    act(() => result.current.issueDialog.onOpen())
    expect(result.current.issueDialog.type).toBe('bug')
    expect(result.current.issueDialog.typeOptions.map((option) => option.value)).toEqual(['bug'])
    const { result: planner } = setup(PM)
    expect(planner.current.issueDialog.typeOptions.map((option) => option.value)).toEqual(['epic', 'story', 'task', 'bug'])
  })

  test('shows the message of the server and stays open when the issue is refused', async () => {
    service.create.mockRejectedValue(new ApiError('Issue details are invalid.', 400, { code: 'ISSUE_INPUT_INVALID' }))
    const { result } = setup()
    act(() => result.current.issueDialog.onOpen())
    act(() => result.current.issueDialog.setTitle('x'))
    act(() => result.current.issueDialog.onSubmit())
    await waitFor(() => expect(result.current.issueDialog.error).toBe('Issue details are invalid.'))
    expect(result.current.issueDialog.open).toBe(true)
  })
})

describe('sprints', () => {
  test('a new sprint starts today and runs two weeks unless the dates change', async () => {
    service.createSprint.mockResolvedValue({} as never)
    const { result } = setup()
    act(() => result.current.sprintDialog.onOpenCreate())
    const { startsOn, endsOn } = result.current.sprintDialog
    expect(Math.round((Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000)).toBe(13)
    act(() => result.current.sprintDialog.setName(' Sprint 4 '))
    act(() => result.current.sprintDialog.onSubmit())
    await waitFor(() => expect(result.current.sprintDialog.open).toBe(false))
    expect(service.createSprint).toHaveBeenCalledWith('t', 'w1', 'p1', { name: 'Sprint 4', goal: '', startsOn, endsOn })
  })

  test('editing fills the dialog with the sprint and saves the change', async () => {
    service.updateSprint.mockResolvedValue({} as never)
    const { result } = setup()
    act(() => result.current.sprintDialog.onOpenEdit('s2'))
    expect(result.current.sprintDialog).toMatchObject({
      open: true,
      editing: true,
      name: 'Sprint 2',
      startsOn: '2026-07-16',
      endsOn: '2026-07-30',
    })
    act(() => result.current.sprintDialog.setGoal('Payments'))
    act(() => result.current.sprintDialog.onSubmit())
    await waitFor(() =>
      expect(service.updateSprint).toHaveBeenCalledWith('t', 'w1', 'p1', 's2', {
        name: 'Sprint 2',
        goal: 'Payments',
        startsOn: '2026-07-16',
        endsOn: '2026-07-30',
      }),
    )
  })

  test('only a planned sprint can start, and none while another runs', () => {
    expect(setup(PM).result.current.canStartSprint).toBe(false)
    const { result } = renderHook(
      () =>
        useBacklogActionsViewModel({
          workspaceId: 'w1',
          projectId: 'p1',
          access: PM,
          epics: [],
          openSprints: [sprints[1]],
          productGoal: '',
        }),
      { wrapper: Wrapper },
    )
    expect(result.current.canStartSprint).toBe(true)
    expect(
      renderHook(
        () =>
          useBacklogActionsViewModel({
            workspaceId: 'w1',
            projectId: 'p1',
            access: MEMBER,
            epics: [],
            openSprints: [sprints[1]],
            productGoal: '',
          }),
        { wrapper: Wrapper },
      ).result.current.canStartSprint,
    ).toBe(false)
  })

  test('starting a sprint is asked of the server', async () => {
    service.startSprint.mockResolvedValue({} as never)
    const { result } = setup()
    act(() => result.current.startSprint('s2'))
    await waitFor(() => expect(service.startSprint).toHaveBeenCalledWith('t', 'w1', 'p1', 's2'))
  })

  test('closing offers the backlog and the other planned sprints, and sends the choice', async () => {
    service.closeSprint.mockResolvedValue({} as never)
    const { result } = setup()
    act(() => result.current.closeDialog.onOpen('s1'))
    expect(result.current.closeDialog).toMatchObject({ open: true, name: 'Sprint 1', carryTo: 'backlog' })
    expect(result.current.closeDialog.options.map((option) => option.value)).toEqual(['backlog', 's2', 's3'])
    act(() => result.current.closeDialog.setCarryTo('s2'))
    act(() => result.current.closeDialog.onSubmit())
    await waitFor(() => expect(service.closeSprint).toHaveBeenCalledWith('t', 'w1', 'p1', 's1', 's2'))
    await waitFor(() => expect(result.current.closeDialog.open).toBe(false))
  })
})

describe('adding an item to a sprint', () => {
  test('goes straight in when the gate lets it', async () => {
    service.addSprintItem.mockResolvedValue(undefined as never)
    const { result } = setup()
    act(() => result.current.addToSprint('i1', 's2', 'Task'))
    await waitFor(() => expect(service.addSprintItem).toHaveBeenCalledWith('t', 'w1', 'p1', 's2', 'i1'))
    expect(result.current.overrideDialog.open).toBe(false)
  })

  test('asks the PM for a reason when the gate refuses, then adds it with that reason', async () => {
    service.addSprintItem.mockRejectedValueOnce(
      new ApiError('Not ready.', 409, { code: 'SPRINT_ITEM_NOT_READY', details: { missing: ['status', 'points'] } }),
    )
    service.addSprintItem.mockResolvedValueOnce(undefined as never)
    const { result } = setup(PM)
    act(() => result.current.addToSprint('i1', 's2', 'Pay with a card'))
    await waitFor(() => expect(result.current.overrideDialog.open).toBe(true))
    expect(result.current.overrideDialog.title).toBe('Pay with a card')
    expect(result.current.overrideDialog.reasons.map((reason) => reason.label)).toEqual(['It is not Ready yet.', 'It has no points.'])
    expect(result.current.overrideDialog.canSubmit).toBe(false)
    act(() => result.current.overrideDialog.setReason('  The customer asked  '))
    act(() => result.current.overrideDialog.onSubmit())
    await waitFor(() => expect(service.addSprintItem).toHaveBeenLastCalledWith('t', 'w1', 'p1', 's2', 'i1', 'The customer asked'))
    await waitFor(() => expect(result.current.overrideDialog.open).toBe(false))
  })

  test('shows the message of the server instead when the person is not the PM', async () => {
    service.addSprintItem.mockRejectedValue(
      new ApiError('Only a Ready story with points can enter a sprint.', 409, {
        code: 'SPRINT_ITEM_NOT_READY',
        details: { missing: ['points'] },
      }),
    )
    const { result } = setup(LEAD)
    act(() => result.current.addToSprint('i1', 's2', 'Task'))
    await waitFor(() => expect(result.current.rowError).toBe('Only a Ready story with points can enter a sprint.'))
    expect(result.current.overrideDialog.open).toBe(false)
  })
})

describe('single actions on a row', () => {
  test('points are set, and cleared with an empty value', async () => {
    service.update.mockResolvedValue({} as never)
    const { result } = setup()
    act(() => result.current.setPoints('i1', '8'))
    await waitFor(() => expect(service.update).toHaveBeenLastCalledWith('t', 'w1', 'p1', 'i1', { points: 8 }))
    act(() => result.current.setPoints('i1', ''))
    await waitFor(() => expect(service.update).toHaveBeenLastCalledWith('t', 'w1', 'p1', 'i1', { points: null }))
  })

  test('a draft is published, and an item leaves its sprint', async () => {
    service.publish.mockResolvedValue({} as never)
    service.removeSprintItem.mockResolvedValue(undefined as never)
    const { result } = setup()
    act(() => result.current.publish('i1'))
    await waitFor(() => expect(service.publish).toHaveBeenCalledWith('t', 'w1', 'p1', 'i1'))
    act(() => result.current.removeFromSprint('s1', 'i2'))
    await waitFor(() => expect(service.removeSprintItem).toHaveBeenCalledWith('t', 'w1', 'p1', 's1', 'i2'))
  })

  test('moving up puts the item before the one above it, and moving down after the one below', async () => {
    service.rank.mockResolvedValue({} as never)
    const { result } = setup()
    const ids = ['a', 'b', 'c', 'd']
    act(() => result.current.move(ids, 2, 'up'))
    await waitFor(() => expect(service.rank).toHaveBeenLastCalledWith('t', 'w1', 'p1', 'c', { afterId: 'a', beforeId: 'b' }))
    act(() => result.current.move(ids, 1, 'down'))
    await waitFor(() => expect(service.rank).toHaveBeenLastCalledWith('t', 'w1', 'p1', 'b', { afterId: 'c', beforeId: 'd' }))
    act(() => result.current.move(ids, 1, 'up'))
    await waitFor(() => expect(service.rank).toHaveBeenLastCalledWith('t', 'w1', 'p1', 'b', { afterId: null, beforeId: 'a' }))
    act(() => result.current.move(ids, 2, 'down'))
    await waitFor(() => expect(service.rank).toHaveBeenLastCalledWith('t', 'w1', 'p1', 'c', { afterId: 'd', beforeId: null }))
  })

  test('the first cannot go up and the last cannot go down', async () => {
    const { result } = setup()
    act(() => result.current.move(['a', 'b'], 0, 'up'))
    act(() => result.current.move(['a', 'b'], 1, 'down'))
    expect(service.rank).not.toHaveBeenCalled()
  })

  test('shows the message of the server above the lists when an action is refused', async () => {
    service.publish.mockRejectedValue(new ApiError('Your role cannot do this.', 403, { code: 'ROLE_NOT_ALLOWED' }))
    const { result } = setup()
    act(() => result.current.publish('i1'))
    await waitFor(() => expect(result.current.rowError).toBe('Your role cannot do this.'))
    service.publish.mockResolvedValue({} as never)
    act(() => result.current.publish('i1'))
    await waitFor(() => expect(result.current.rowError).toBeNull())
  })
})

describe('the Product Goal', () => {
  test('opens with the current goal and saves the trimmed text', async () => {
    service.updateSettings.mockResolvedValue({} as never)
    const { result } = setup()
    act(() => result.current.goalDialog.onOpen())
    expect(result.current.goalDialog).toMatchObject({ open: true, goal: 'Halve checkout time' })
    act(() => result.current.goalDialog.setGoal('  Double the conversion  '))
    act(() => result.current.goalDialog.onSubmit())
    await waitFor(() => expect(service.updateSettings).toHaveBeenCalledWith('t', 'w1', 'p1', { productGoal: 'Double the conversion' }))
    await waitFor(() => expect(result.current.goalDialog.open).toBe(false))
  })
})

describe('dropping an item', () => {
  const placed = { afterId: 'x', beforeId: 'y' }
  const drop = (over: Record<string, unknown> = {}) => ({
    issueId: 'i1',
    title: 'Pay with a card',
    from: 's1',
    to: 's1',
    ...placed,
    ...over,
  })

  test('inside its own list it is only ranked', async () => {
    service.rank.mockResolvedValue({} as never)
    const { result } = setup()
    act(() => result.current.drop(drop()))
    await waitFor(() => expect(service.rank).toHaveBeenCalledWith('t', 'w1', 'p1', 'i1', placed))
    expect(service.addSprintItem).not.toHaveBeenCalled()
    expect(service.removeSprintItem).not.toHaveBeenCalled()
  })

  test('into the backlog it leaves its sprint, then is ranked', async () => {
    service.removeSprintItem.mockResolvedValue(undefined as never)
    service.rank.mockResolvedValue({} as never)
    const { result } = setup()
    act(() => result.current.drop(drop({ from: 's1', to: 'backlog' })))
    await waitFor(() => expect(service.rank).toHaveBeenCalledWith('t', 'w1', 'p1', 'i1', placed))
    expect(service.removeSprintItem).toHaveBeenCalledWith('t', 'w1', 'p1', 's1', 'i1')
  })

  test('into a sprint it is added, then ranked', async () => {
    service.addSprintItem.mockResolvedValue(undefined as never)
    service.rank.mockResolvedValue({} as never)
    const { result } = setup()
    act(() => result.current.drop(drop({ from: 'backlog', to: 's2' })))
    await waitFor(() => expect(service.rank).toHaveBeenCalledWith('t', 'w1', 'p1', 'i1', placed))
    expect(service.addSprintItem).toHaveBeenCalledWith('t', 'w1', 'p1', 's2', 'i1')
  })

  test('into an empty sprint it is added and not ranked, as there is nothing to rank it against', async () => {
    service.addSprintItem.mockResolvedValue(undefined as never)
    const { result } = setup()
    act(() => result.current.drop(drop({ from: 'backlog', to: 's2', afterId: null, beforeId: null })))
    await waitFor(() => expect(service.addSprintItem).toHaveBeenCalled())
    expect(service.rank).not.toHaveBeenCalled()
  })

  test('when the gate refuses the PM, the reason is asked for and the item is ranked after it is added', async () => {
    service.addSprintItem.mockRejectedValueOnce(
      new ApiError('Not ready.', 409, { code: 'SPRINT_ITEM_NOT_READY', details: { missing: ['points'] } }),
    )
    service.addSprintItem.mockResolvedValueOnce(undefined as never)
    service.rank.mockResolvedValue({} as never)
    const { result } = setup(PM)
    act(() => result.current.drop(drop({ from: 'backlog', to: 's2' })))
    await waitFor(() => expect(result.current.overrideDialog.open).toBe(true))
    expect(service.rank).not.toHaveBeenCalled()
    act(() => result.current.overrideDialog.setReason('Urgent'))
    act(() => result.current.overrideDialog.onSubmit())
    await waitFor(() => expect(service.rank).toHaveBeenCalledWith('t', 'w1', 'p1', 'i1', placed))
    expect(service.addSprintItem).toHaveBeenLastCalledWith('t', 'w1', 'p1', 's2', 'i1', 'Urgent')
  })

  test('someone who may not plan changes nothing', () => {
    const { result } = setup(MEMBER)
    act(() => result.current.drop(drop()))
    expect(service.rank).not.toHaveBeenCalled()
  })
})
