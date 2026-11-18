import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FlowView, type SprintSummary } from '@/features/projects/views/flow.view'

const flow = {
  counts: {
    brd: { total: 1, approved: 1, inReview: 0 },
    prd: { total: 1, approved: 1, inReview: 0 },
    epic: { total: 1, published: 1 },
    story: { total: 2, done: 1 },
    task: { total: 3, done: 1 },
  },
  waiting: [],
  team: [],
} as unknown as Parameters<typeof FlowView>[0]['flow']

const summary = (sprint: SprintSummary['sprint']): SprintSummary => ({ status: 'ready', error: null, sprint }) as SprintSummary

const running = {
  name: 'Sprint 2',
  goal: 'Ship checkout',
  daysLeft: '5 days left',
  committed: 8,
  done: 5,
  percent: 63,
  items: '2 of 3 items done',
  points: '5 of 8 points done',
}

beforeEach(async () => {
  await i18next.changeLanguage('en')
})
afterEach(cleanup)

describe('FlowView sprint card', () => {
  test('shows the running sprint with its goal, days left, and points, and opens the board', () => {
    const onGo = vi.fn()
    render(<FlowView flow={flow} sprint={summary(running)} onGo={onGo} onManageTeam={vi.fn()} />)
    const card = screen.getByTestId('projects-flow-sprint')
    expect(card).toHaveTextContent('Sprint 2')
    expect(card).toHaveTextContent('Ship checkout')
    expect(card).toHaveTextContent('5 days left')
    expect(card).toHaveTextContent('5 of 8 points done')
    fireEvent.click(screen.getByTestId('projects-flow-sprint-open'))
    expect(onGo).toHaveBeenCalledWith('board')
  })

  test('with no running sprint it says so and opens the backlog', () => {
    const onGo = vi.fn()
    render(<FlowView flow={flow} sprint={summary(null)} onGo={onGo} onManageTeam={vi.fn()} />)
    expect(screen.getByTestId('projects-flow-sprint')).toHaveTextContent('No sprint is running.')
    fireEvent.click(screen.getByTestId('projects-flow-sprint-open'))
    expect(onGo).toHaveBeenCalledWith('backlog')
  })

  test('leaves the card out while it loads, and when the screen gives none', () => {
    const { rerender } = render(
      <FlowView flow={flow} sprint={{ ...summary(null), status: 'loading' } as SprintSummary} onGo={vi.fn()} onManageTeam={vi.fn()} />,
    )
    expect(screen.queryByTestId('projects-flow-sprint')).toBeNull()
    rerender(<FlowView flow={flow} onGo={vi.fn()} onManageTeam={vi.fn()} />)
    expect(screen.queryByTestId('projects-flow-sprint')).toBeNull()
  })
})
