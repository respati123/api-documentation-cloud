import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { LoadMoreButton } from './load-more-button'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LoadMoreButton', () => {
  test('renders nothing when there is no next page', () => {
    render(<LoadMoreButton hasMore={false} isLoading={false} onLoadMore={vi.fn()} testId="list-more" />)

    expect(screen.queryByTestId('list-more')).not.toBeInTheDocument()
  })

  test('loads the next page when clicked', () => {
    const onLoadMore = vi.fn()
    render(<LoadMoreButton hasMore isLoading={false} onLoadMore={onLoadMore} testId="list-more" />)

    fireEvent.click(screen.getByTestId('list-more'))

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  test('shows the loading label and disables itself while a page loads', () => {
    render(<LoadMoreButton hasMore isLoading onLoadMore={vi.fn()} testId="list-more" />)

    expect(screen.getByTestId('list-more')).toBeDisabled()
    expect(screen.getByTestId('list-more')).toHaveTextContent('Loading…')
  })
})
