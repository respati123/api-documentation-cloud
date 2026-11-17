import '@/shared/i18n'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { type ReportsProps, ReportsView } from '@/features/projects/views/reports.view'

const scrum = (): ReportsProps =>
  ({
    mode: 'scrum',
    status: 'ready',
    error: null,
    onRetry: vi.fn(),
    subtitle: 'How the sprints go.',
    sprint: { options: [{ value: 'b', label: 'Sprint b' }], selected: 'b', onSelect: vi.fn(), hasSprint: true },
    burndown: {
      labels: ['Jul 1', 'Jul 2'],
      series: [
        { id: 'ideal', label: 'Ideal', tone: 3, dashed: true, values: [8, 0] },
        { id: 'remaining', label: 'Remaining', tone: 1, values: [8, 5] },
      ],
      ariaLabel: 'Burndown of Sprint b, 8 points committed',
      summary: ['Jul 1: 8 points left'],
    },
    report: {
      committed: '8 points',
      completed: '3 points',
      noneLabel: 'None.',
      groups: [
        { id: 'finished', title: 'Finished', rows: [{ id: '1', key: 'PARI-1', title: 'Item 1', detail: '3 points' }] },
        { id: 'notFinished', title: 'Not finished', rows: [] },
      ],
    },
    velocity: {
      groups: [{ id: 'a', label: 'Sprint a', values: [10, 8] }],
      series: [
        { id: 'committed', label: 'Committed', tone: 1 },
        { id: 'completed', label: 'Completed', tone: 2 },
      ],
      average: 'Average completed: 8 points',
      summary: ['Sprint a: 10 committed, 8 completed'],
      empty: false,
    },
    flow: null,
  }) as unknown as ReportsProps

const kanban = (): ReportsProps =>
  ({
    mode: 'kanban',
    status: 'ready',
    error: null,
    onRetry: vi.fn(),
    subtitle: 'How work flows.',
    sprint: { options: [], selected: '', onSelect: vi.fn(), hasSprint: false },
    burndown: null,
    report: null,
    velocity: null,
    flow: {
      period: {
        value: '30',
        options: [
          { value: '30', label: 'Last 30 days' },
          { value: '60', label: 'Last 60 days' },
        ],
        onSelect: vi.fn(),
      },
      throughput: '4 items finished',
      cycleTime: {
        hasData: true,
        tiles: [
          { id: 'average', label: 'Average', value: '2.5 days' },
          { id: 'median', label: 'Median', value: '2 days' },
          { id: 'p85', label: '85th percentile', value: '4 days' },
        ],
      },
      wip: [{ status: 'in_progress', label: 'In progress', count: 2, limit: 'Limit 1', over: true, overLabel: 'Over the limit' }],
      oldest: [{ id: 'x', key: 'PARI-9', title: 'Old one', detail: '6 days open' }],
      cumulative: {
        labels: ['Jul 1', 'Jul 2'],
        series: [
          { id: 'done', label: 'Done', tone: 2, values: [1, 2] },
          { id: 'in_progress', label: 'In progress', tone: 3, values: [2, 2] },
          { id: 'todo', label: 'To do', tone: 1, values: [3, 2] },
        ],
        ariaLabel: 'Cumulative flow of the items of the project',
        summary: ['Jul 2: 2 done, 2 in progress, 2 to do'],
      },
    },
  }) as unknown as ReportsProps

beforeEach(async () => {
  await i18next.changeLanguage('en')
})
afterEach(cleanup)

describe('ReportsView, scrum', () => {
  test('shows the burndown chart, the report with its groups, and the velocity', () => {
    render(<ReportsView vm={scrum()} />)
    expect(screen.getByRole('img', { name: 'Burndown of Sprint b, 8 points committed' })).toBeInTheDocument()
    const report = screen.getByTestId('reports-report')
    expect(within(report).getByText(/Committed: 8 points/)).toBeInTheDocument()
    expect(within(report).getByText(/Completed: 3 points/)).toBeInTheDocument()
    expect(within(screen.getByTestId('reports-group-finished')).getByTestId('reports-row-1')).toHaveTextContent('PARI-1')
    expect(within(screen.getByTestId('reports-group-notFinished')).getByText('None.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Velocity of the last closed sprints' })).toBeInTheDocument()
    expect(screen.getByText('Average completed: 8 points')).toBeInTheDocument()
  })

  test('says so when no sprint has started, and when no sprint has closed', () => {
    const none = scrum()
    none.sprint.hasSprint = false
    none.burndown = null
    none.report = null
    none.velocity = { ...none.velocity, empty: true } as ReportsProps['velocity']
    render(<ReportsView vm={none} />)
    expect(screen.getByTestId('reports-none')).toHaveTextContent('No sprint to report on yet')
    expect(screen.getByTestId('reports-velocity')).toHaveTextContent('No sprint has closed yet.')
  })
})

describe('ReportsView, kanban', () => {
  test('shows throughput, cycle time, the columns with their limits, the oldest items, and the flow chart', () => {
    render(<ReportsView vm={kanban()} />)
    expect(screen.getByTestId('reports-throughput')).toHaveTextContent('4 items finished')
    expect(screen.getByTestId('reports-cycle-average')).toHaveTextContent('2.5 days')
    expect(screen.getByTestId('reports-cycle-p85')).toHaveTextContent('4 days')
    const column = screen.getByTestId('reports-wip-in_progress')
    expect(column).toHaveTextContent('In progress')
    expect(column).toHaveTextContent('Limit 1')
    expect(column).toHaveTextContent('Over the limit')
    expect(screen.getByTestId('reports-row-x')).toHaveTextContent('6 days open')
    expect(screen.getByRole('img', { name: 'Cumulative flow of the items of the project' })).toBeInTheDocument()
  })

  test('says so when nothing finished, and nothing is open', () => {
    const empty = kanban()
    empty.flow = { ...empty.flow, cycleTime: { hasData: false, tiles: [] }, wip: [], oldest: [] } as ReportsProps['flow']
    render(<ReportsView vm={empty} />)
    expect(screen.getByTestId('reports-cycle')).toHaveTextContent('No item finished in this period.')
    expect(screen.getByTestId('reports-wip')).toHaveTextContent('Nothing is in progress.')
    expect(screen.getByTestId('reports-age')).toHaveTextContent('Nothing is open.')
  })
})

describe('ReportsView, states', () => {
  test('shows a placeholder while it loads, and the message of the server with a retry', () => {
    const { rerender } = render(<ReportsView vm={{ ...scrum(), status: 'loading' } as ReportsProps} />)
    expect(screen.getByTestId('reports-loading')).toBeInTheDocument()
    const failed = { ...scrum(), status: 'error', error: 'You may not read this project.' } as ReportsProps
    rerender(<ReportsView vm={failed} />)
    expect(screen.getByTestId('reports-error')).toHaveTextContent('You may not read this project.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(failed.onRetry).toHaveBeenCalled()
  })
})
