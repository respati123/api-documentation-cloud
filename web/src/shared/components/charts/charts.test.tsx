import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { BarChart } from '@/shared/components/charts/bar-chart'
import { LineChart } from '@/shared/components/charts/line-chart'
import { StackedAreaChart } from '@/shared/components/charts/stacked-area-chart'

afterEach(cleanup)

describe('LineChart', () => {
  const props = {
    labels: ['1 Jul', '2 Jul', '3 Jul', '4 Jul'],
    series: [
      { id: 'ideal', label: 'Ideal', tone: 3 as const, dashed: true, values: [8, 6, 3, 0] },
      { id: 'remaining', label: 'Remaining', tone: 1 as const, values: [8, 7, null, null] },
    ],
    ariaLabel: 'Burndown of Sprint 1',
    summary: ['1 Jul: 8 points left', '2 Jul: 7 points left'],
    testId: 'chart',
  }

  test('is an image with a name, a line for each series, and a legend', () => {
    render(<LineChart {...props} />)
    expect(screen.getByRole('img', { name: 'Burndown of Sprint 1' })).toBeInTheDocument()
    expect(screen.getByTestId('chart-line-ideal').getAttribute('d')).toMatch(/^M/)
    expect(screen.getByTestId('chart-line-remaining').getAttribute('d')).not.toContain('NaN')
    expect(screen.getByText('Ideal')).toBeInTheDocument()
    expect(screen.getByText('Remaining')).toBeInTheDocument()
  })

  test('says what it shows as text for a screen reader', () => {
    render(<LineChart {...props} />)
    expect(screen.getByText('2 Jul: 7 points left')).toBeInTheDocument()
  })

  test('a series with no values has no line, and a chart without labels does not break', () => {
    render(<LineChart {...props} labels={[]} series={[{ id: 'none', label: 'None', tone: 2, values: [] }]} />)
    expect(screen.getByTestId('chart-line-none').getAttribute('d')).toBe('')
  })

  test('puts the dashed series on a dashed line', () => {
    render(<LineChart {...props} />)
    expect(screen.getByTestId('chart-line-ideal').getAttribute('class')).toContain('stroke-dasharray')
    expect(screen.getByTestId('chart-line-remaining').getAttribute('class')).not.toContain('stroke-dasharray')
  })
})

describe('BarChart', () => {
  test('draws a bar for each value of each group, as tall as the value', () => {
    render(
      <BarChart
        testId="bars"
        ariaLabel="Velocity"
        summary={['Sprint 1: 8 committed, 5 completed']}
        series={[
          { id: 'committed', label: 'Committed', tone: 1 },
          { id: 'completed', label: 'Completed', tone: 2 },
        ]}
        groups={[
          { id: 's1', label: 'Sprint 1', values: [8, 5] },
          { id: 's2', label: 'Sprint 2', values: [10, 0] },
        ]}
      />,
    )
    const committed = Number(screen.getByTestId('bars-bar-s1-committed').getAttribute('height'))
    const completed = Number(screen.getByTestId('bars-bar-s1-completed').getAttribute('height'))
    expect(committed).toBeGreaterThan(completed)
    expect(Number(screen.getByTestId('bars-bar-s2-completed').getAttribute('height'))).toBe(0)
    expect(screen.getByRole('img', { name: 'Velocity' })).toBeInTheDocument()
  })

  test('an empty chart does not break', () => {
    render(<BarChart testId="empty" ariaLabel="Nothing" summary={[]} series={[{ id: 'a', label: 'A', tone: 1 }]} groups={[]} />)
    expect(screen.getByRole('img', { name: 'Nothing' })).toBeInTheDocument()
  })
})

describe('StackedAreaChart', () => {
  test('stacks the series, so the top series ends at the total', () => {
    render(
      <StackedAreaChart
        testId="flow"
        ariaLabel="Cumulative flow"
        summary={['Today: 3 done, 2 in progress, 1 todo']}
        labels={['1 Jul', '2 Jul']}
        series={[
          { id: 'done', label: 'Done', tone: 2, values: [1, 3] },
          { id: 'in_progress', label: 'In progress', tone: 3, values: [1, 2] },
          { id: 'todo', label: 'To do', tone: 1, values: [4, 1] },
        ]}
      />,
    )
    for (const id of ['done', 'in_progress', 'todo']) expect(screen.getByTestId(`flow-area-${id}`).getAttribute('d')).toMatch(/^M.* Z$/)
    expect(screen.getByRole('img', { name: 'Cumulative flow' })).toBeInTheDocument()
  })
})
