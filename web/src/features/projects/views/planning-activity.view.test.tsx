import '@/shared/i18n'
import { cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { PlanningActivityView } from '@/features/projects/views/planning-activity.view'

const entry = {
  id: 'e-1',
  actor: 'maya@contoh.test',
  action: 'design_attached',
  viaAgent: true,
  keyName: 'claude-code laptop',
  when: 'now',
}

beforeEach(async () => {
  await i18next.changeLanguage('en')
})

afterEach(() => {
  cleanup()
})

describe('PlanningActivityView', () => {
  test('agent work names the key it came through', () => {
    render(<PlanningActivityView activity={[entry]} />)

    expect(screen.getByTestId('planning-activity')).toHaveTextContent('via key claude-code laptop')
  })

  test('agent work from an event without a key name falls back to the generic label', () => {
    render(<PlanningActivityView activity={[{ ...entry, keyName: null }]} />)

    expect(screen.getByTestId('planning-activity')).not.toHaveTextContent('via key')
  })

  test('nothing renders when there is no activity', () => {
    render(<PlanningActivityView activity={[]} />)

    expect(screen.queryByTestId('planning-activity')).not.toBeInTheDocument()
  })
})
