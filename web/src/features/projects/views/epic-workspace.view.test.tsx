import '@/shared/i18n'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { type EpicWorkspaceProps, EpicWorkspaceView } from '@/features/projects/views/epic-workspace.view'
import { parseMarkdown } from '@/shared/utils/markdown'

type Epic = NonNullable<EpicWorkspaceProps['epic']>

const document = (kind: 'spec' | 'design' | 'contract', over: Partial<Epic['spec']> = {}): Epic['spec'] => ({
  kind,
  exists: true,
  title: `AUTH-001 ${kind}`,
  version: 'Version 2',
  state: 'Waiting for approval',
  tone: 'accent',
  stale: false,
  missing: `No ${kind} yet.`,
  blocked: null,
  sections: [{ id: 'problem', label: 'Problem', blocks: parseMarkdown('People cannot sign in.') }],
  canApprove: true,
  approving: false,
  onApprove: vi.fn(),
  ...over,
})

const ticket = (id: string, over: Partial<Epic['tickets']['waves'][number]['items'][number]> = {}) => ({
  id,
  code: `AUTH-001-BE-${id}`,
  title: `Ticket ${id}`,
  role: 'backend',
  size: 'M' as const,
  ready: true,
  readyLabel: 'Ready',
  failing: [],
  dependsOn: null,
  assignee: 'Unassigned',
  ...over,
})

function epic(over: Partial<Epic> = {}): Epic {
  return {
    id: 'e1',
    code: 'AUTH-001',
    title: 'Sign in',
    description: '',
    loading: false,
    onBack: vi.fn(),
    tab: 'overview',
    tabs: ['overview', 'spec', 'design', 'contract', 'tickets', 'assign'].map((value) => ({ value, label: value })) as Epic['tabs'],
    onTab: vi.fn(),
    stages: [
      {
        id: 'spec',
        label: 'Spec',
        state: 'approved',
        stateLabel: 'Approved',
        owner: 'The PM approves',
        current: false,
        tone: 'success',
        onOpen: vi.fn(),
      },
      {
        id: 'design',
        label: 'Design',
        state: 'stale',
        stateLabel: 'Stale',
        owner: 'The tech lead approves',
        current: true,
        tone: 'warning',
        onOpen: vi.fn(),
      },
      {
        id: 'contract',
        label: 'Contract',
        state: 'missing',
        stateLabel: 'Not written yet',
        owner: 'x',
        current: false,
        tone: 'secondary',
        onOpen: vi.fn(),
      },
      {
        id: 'tickets',
        label: 'Tickets',
        state: 'missing',
        stateLabel: 'Not written yet',
        owner: 'x',
        current: false,
        tone: 'secondary',
        onOpen: vi.fn(),
      },
    ],
    spec: document('spec'),
    design: document('design', { stale: true, canApprove: false }),
    contract: document('contract', { exists: false, canApprove: false, blocked: 'Waiting for: design_approved' }),
    criteria: {
      coverage: '2 active · 1 in design · 0 in tickets · 0 with a test case',
      flow: '',
      flows: [
        { value: '', label: 'All flows' },
        { value: 'Sign in', label: 'Sign in' },
        { value: 'Sign up', label: 'Sign up' },
      ],
      onFlow: vi.fn(),
      items: [
        {
          id: 'c1',
          code: 'AC1',
          title: 'Locked after failures',
          flow: 'Sign in',
          given: 'rina@contoh.id failed 4 times',
          when: 'she fails a 5th time',
          outcomes: ['the account locks for 15 minutes'],
          struck: false,
          struckReason: null,
          coverage: [
            { id: 'inDesign', label: 'Design', on: true },
            { id: 'inTask', label: 'Ticket', on: false },
            { id: 'hasTestCase', label: 'Test case', on: false },
          ],
        },
        {
          id: 'c2',
          code: 'AC2',
          title: 'Old rule',
          flow: 'Sign up',
          given: 'g',
          when: 'w',
          outcomes: ['t'],
          struck: true,
          struckReason: 'Reason: moved to AUTH-002',
          coverage: [],
        },
      ],
    },
    matrix: {
      repos: ['backend', 'web'],
      rows: [
        {
          id: 'c1',
          code: 'AC1',
          title: 'Locked after failures',
          cells: [
            { id: 'c1-backend', text: 'POST /v1/auth/login · integration', empty: false },
            { id: 'c1-web', text: '—', empty: true },
          ],
        },
      ],
    },
    tickets: {
      total: 3,
      waves: [
        { id: 'wave-1', label: 'Wave 1', items: [ticket('1')] },
        {
          id: 'wave-2',
          label: 'Wave 2',
          items: [
            ticket('2', {
              ready: false,
              readyLabel: 'Not Ready',
              dependsOn: 'Waits for AUTH-001-BE-1',
              failing: [{ id: '2-8', label: 'Item 8: size L must be split' }],
            }),
          ],
        },
      ],
      looped: [ticket('3')],
    },
    assign: {
      rows: [
        {
          id: '1',
          code: 'AUTH-001-BE-1',
          title: 'Ticket 1',
          points: 3,
          value: 'sari',
          options: [
            { value: 'sari', label: 'sari@contoh.id' },
            { value: '', label: 'Do not assign yet' },
          ],
          disabled: false,
          onChange: vi.fn(),
        },
      ],
      load: [{ id: 'sari', name: 'sari@contoh.id', before: 2, after: 5 }],
      canConfirm: true,
      onlyLead: false,
      confirming: false,
      onConfirm: vi.fn(),
    },
    ...over,
  }
}

function props(over: Partial<EpicWorkspaceProps> = {}): EpicWorkspaceProps {
  return {
    status: 'ready',
    error: null,
    actionError: null,
    onRetry: vi.fn(),
    list: [{ id: 'e1', code: 'AUTH-001', title: 'Sign in', status: null, onOpen: vi.fn() }],
    more: { hasMore: false, isLoadingMore: false, onLoadMore: vi.fn() },
    open: vi.fn(),
    epic: null,
    ...over,
  }
}

beforeEach(async () => {
  await i18next.changeLanguage('en')
})
afterEach(cleanup)

describe('EpicWorkspaceView', () => {
  test('the list opens an epic by its feature code', () => {
    const vm = props()
    render(<EpicWorkspaceView vm={vm} />)
    expect(screen.getByTestId('epic-space-open-e1')).toHaveTextContent('AUTH-001')
    fireEvent.click(screen.getByTestId('epic-space-open-e1'))
    expect(vm.list[0].onOpen).toHaveBeenCalled()
  })

  test('the overview stepper marks the current step and opens its tab', () => {
    const detail = epic()
    render(<EpicWorkspaceView vm={props({ epic: detail })} />)
    expect(screen.getByTestId('epic-space-stage-design')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByTestId('epic-space-stage-spec')).not.toHaveAttribute('aria-current')
    fireEvent.click(screen.getByTestId('epic-space-stage-design'))
    expect(detail.stages[1].onOpen).toHaveBeenCalled()
  })

  test('CLOUD-001 AC10: the spec shows its sections, approve, and the criteria as Given / When / Then with coverage', () => {
    const detail = epic({ tab: 'spec' })
    render(<EpicWorkspaceView vm={props({ epic: detail })} />)
    expect(screen.getByTestId('epic-space-spec-problem')).toHaveTextContent('People cannot sign in.')
    fireEvent.click(screen.getByTestId('epic-space-approve-spec'))
    expect(detail.spec.onApprove).toHaveBeenCalled()
    const card = screen.getByTestId('epic-space-criterion-AC1')
    expect(within(card).getByTestId('epic-space-gwt-AC1')).toHaveTextContent('rina@contoh.id failed 4 times')
    expect(within(card).getByTestId('epic-space-gwt-AC1')).toHaveTextContent('the account locks for 15 minutes')
    expect(screen.getByTestId('epic-space-criteria')).toHaveTextContent('2 active · 1 in design')
    expect(screen.getByTestId('epic-space-criterion-AC2')).toHaveTextContent('Reason: moved to AUTH-002')
    expect(screen.getByTestId('epic-space-flow')).toBeInTheDocument()
  })

  test('a stale design warns and cannot be approved, and the matrix has one column per repo', () => {
    render(<EpicWorkspaceView vm={props({ epic: epic({ tab: 'design' }) })} />)
    expect(screen.getByTestId('epic-space-design-stale')).toBeInTheDocument()
    expect(screen.queryByTestId('epic-space-approve-design')).not.toBeInTheDocument()
    expect(screen.getByTestId('epic-space-matrix-AC1')).toHaveTextContent('POST /v1/auth/login · integration')
  })

  test('a missing contract says who writes it and what it waits for', () => {
    render(<EpicWorkspaceView vm={props({ epic: epic({ tab: 'contract' }) })} />)
    expect(screen.getByTestId('epic-space-contract')).toHaveTextContent('No contract yet.')
    expect(screen.getByTestId('epic-space-contract')).toHaveTextContent('Waiting for: design_approved')
  })

  test('CLOUD-001 AC16: the tickets show in dependency waves, with the failing readiness items and a loop apart', () => {
    render(<EpicWorkspaceView vm={props({ epic: epic({ tab: 'tickets' }) })} />)
    expect(within(screen.getByTestId('epic-space-wave-1')).getByTestId('epic-space-ticket-1')).toBeInTheDocument()
    const second = within(screen.getByTestId('epic-space-wave-2')).getByTestId('epic-space-ticket-2')
    expect(second).toHaveTextContent('Waits for AUTH-001-BE-1')
    expect(second).toHaveTextContent('Item 8: size L must be split')
    expect(within(screen.getByTestId('epic-space-looped')).getByTestId('epic-space-ticket-3')).toBeInTheDocument()
  })

  test('the assignment proposal shows the load and confirms', () => {
    const detail = epic({ tab: 'assign' })
    render(<EpicWorkspaceView vm={props({ epic: detail })} />)
    expect(screen.getByTestId('epic-space-load-sari')).toHaveTextContent('25')
    fireEvent.click(screen.getByTestId('epic-space-assign-confirm'))
    expect(detail.assign.onConfirm).toHaveBeenCalled()
  })

  test('only the tech lead can confirm', () => {
    render(
      <EpicWorkspaceView vm={props({ epic: epic({ tab: 'assign', assign: { ...epic().assign, canConfirm: false, onlyLead: true } }) })} />,
    )
    expect(screen.getByTestId('epic-space-assign-confirm')).toBeDisabled()
    expect(screen.getByTestId('epic-space-assign')).toHaveTextContent('Only the tech lead can confirm the assignment.')
  })
})
