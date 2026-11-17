import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { OidcAuthorizeView } from '@/features/oidc-authorize/views/oidc-authorize.view'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('OidcAuthorizeView', () => {
  test('shows the working message while the sign-in is being completed', () => {
    render(<OidcAuthorizeView isWorking errorMessage={null} onRetry={vi.fn()} />)
    expect(screen.getByTestId('oidc-authorize-working')).toBeInTheDocument()
    expect(screen.queryByTestId('oidc-authorize-error')).toBeNull()
  })

  test('shows the server message unchanged, with a retry button', () => {
    const onRetry = vi.fn()
    render(
      <OidcAuthorizeView
        isWorking={false}
        errorMessage="This app is not registered for sign-in. Ask the administrator to register it."
        onRetry={onRetry}
      />,
    )
    expect(screen.getByTestId('oidc-authorize-error')).toHaveTextContent('This app is not registered for sign-in.')
    fireEvent.click(screen.getByTestId('oidc-authorize-retry-button'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
