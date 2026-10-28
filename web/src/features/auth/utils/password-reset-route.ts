export const passwordResetPath = '/reset-password'

export function isPasswordResetRoute(): boolean {
  return window.location.pathname === passwordResetPath
}

export function readResetToken(): string {
  return new URLSearchParams(window.location.search).get('token') ?? ''
}
