import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { SplitFlap } from './split-flap'

afterEach(() => {
  cleanup()
})

describe('SplitFlap', () => {
  test('exposes the full value to assistive tech and renders one cell per character', () => {
    render(<SplitFlap value="Synced" data-testid="sync-state" />)

    expect(screen.getByTestId('sync-state')).toHaveAccessibleName('Synced')
    expect(screen.getByTestId('sync-state').querySelectorAll('[data-flap-cell]')).toHaveLength(6)
  })

  test('marks only the cells whose character changed', () => {
    const { rerender } = render(<SplitFlap value="Pending" data-testid="sync-state" />)

    rerender(<SplitFlap value="Pushing" data-testid="sync-state" />)

    const cells = Array.from(screen.getByTestId('sync-state').querySelectorAll<HTMLElement>('[data-flap-cell]'))
    expect(cells.map((cell) => cell.dataset.changed)).toEqual(['false', 'true', 'true', 'true', 'false', 'false', 'false'])
  })

  test('does not mark any cell when the value stays the same', () => {
    const { rerender } = render(<SplitFlap value="Pending" data-testid="sync-state" />)

    rerender(<SplitFlap value="Pending" data-testid="sync-state" />)

    const cells = Array.from(screen.getByTestId('sync-state').querySelectorAll<HTMLElement>('[data-flap-cell]'))
    expect(cells.every((cell) => cell.dataset.changed === 'false')).toBe(true)
  })
})
