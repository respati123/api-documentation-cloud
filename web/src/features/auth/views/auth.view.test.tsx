import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AuthView, type AuthViewProps } from './auth.view'

const baseProps: AuthViewProps = {
  mode: 'login',
  isBusy: false,
  errorMessage: null,
  noticeMessage: null,
  inviteMessage: null,
  onModeChange: vi.fn(),
  onSubmit: vi.fn(),
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AuthView', () => {
  test('renders the sign-in form with an email and password field', () => {
    render(<AuthView {...baseProps} />)

    expect(screen.getByTestId('auth-view-container')).toBeInTheDocument()
    expect(screen.getByTestId('auth-email-input')).toBeInTheDocument()
    expect(screen.getByTestId('auth-password-input')).toBeInTheDocument()
    expect(screen.getByTestId('auth-submit-button')).toBeEnabled()
  })

  test('the reset mode shows only the new password field', () => {
    render(<AuthView {...baseProps} mode="reset" />)

    expect(screen.queryByTestId('auth-email-input')).not.toBeInTheDocument()
    expect(screen.getByTestId('auth-password-input')).toBeInTheDocument()
  })

  test('the forgot mode shows only the email field', () => {
    render(<AuthView {...baseProps} mode="forgot" />)

    expect(screen.getByTestId('auth-email-input')).toBeInTheDocument()
    expect(screen.queryByTestId('auth-password-input')).not.toBeInTheDocument()
  })

  test('submitting the form hands the event to the callback', () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault())
    render(<AuthView {...baseProps} onSubmit={onSubmit} />)

    fireEvent.submit(screen.getByTestId('auth-form'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test('the forgot-password link switches to the forgot mode', () => {
    const onModeChange = vi.fn()
    render(<AuthView {...baseProps} onModeChange={onModeChange} />)

    fireEvent.click(screen.getByTestId('auth-forgot-button'))
    expect(onModeChange).toHaveBeenCalledWith('forgot')
  })

  test('shows the error message and disables submit while busy', () => {
    render(<AuthView {...baseProps} isBusy errorMessage="Email or password is incorrect." />)

    expect(screen.getByTestId('auth-submit-button')).toBeDisabled()
    expect(screen.getByTestId('auth-error-message')).toHaveTextContent('Email or password is incorrect.')
  })
})
