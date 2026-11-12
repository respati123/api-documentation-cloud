import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/components/primitives/field'
import { Input } from '@/shared/components/primitives/input'
import { AUTH_BUSY_TEXT, AUTH_SUBMIT_TEXT, AUTH_TEXT } from '../constants/auth-text.constants'
import type { AuthMode } from '../models/auth.model'

export interface AuthFormProps {
  mode: AuthMode
  isBusy: boolean
  errorMessage: string | null
  onModeChange: (mode: AuthMode) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

// Inputs sit on the card surface, not the page background, and the label row carries the forgot link.
const inputClass = 'h-12 rounded-2xl border-transparent bg-card px-4 text-base'

export function AuthForm({ mode, isBusy, errorMessage, onModeChange, onSubmit }: AuthFormProps) {
  const { t } = useTranslation('auth')
  const isNewPassword = mode === 'register' || mode === 'reset'

  return (
    <form data-testid="auth-form" className="grid gap-6" onSubmit={onSubmit}>
      <FieldGroup>
        {mode !== 'reset' && (
          <Field>
            <FieldLabel htmlFor="auth-email">{t(AUTH_TEXT.field.email)}</FieldLabel>
            <Input
              id="auth-email"
              name="email"
              data-testid="auth-email-input"
              type="email"
              autoComplete="email"
              autoFocus
              required
              maxLength={254}
              placeholder={t(AUTH_TEXT.placeholder.email)}
              className={inputClass}
            />
          </Field>
        )}
        {mode !== 'forgot' && (
          <Field>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor="auth-password">
                {mode === 'reset' ? t(AUTH_TEXT.field.newPassword) : t(AUTH_TEXT.field.password)}
              </FieldLabel>
              {mode === 'login' && (
                <Button
                  type="button"
                  variant="link"
                  data-testid="auth-forgot-button"
                  className="h-auto p-0 text-sm text-link underline underline-offset-4"
                  onClick={() => onModeChange('forgot')}
                >
                  {t(AUTH_TEXT.forgot)}
                </Button>
              )}
            </div>
            <Input
              id="auth-password"
              name="password"
              data-testid="auth-password-input"
              type="password"
              autoComplete={isNewPassword ? 'new-password' : 'current-password'}
              autoFocus={mode === 'reset'}
              required
              minLength={isNewPassword ? 10 : 1}
              maxLength={256}
              placeholder={isNewPassword ? t(AUTH_TEXT.placeholder.newPassword) : t(AUTH_TEXT.placeholder.password)}
              className={inputClass}
            />
            {isNewPassword && <FieldDescription>{t(AUTH_TEXT.hint)}</FieldDescription>}
          </Field>
        )}
      </FieldGroup>

      {errorMessage && (
        <Alert variant="destructive" data-testid="auth-error-message">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" data-testid="auth-submit-button" className="h-12 w-full rounded-xl text-base font-medium" disabled={isBusy}>
        {isBusy ? t(AUTH_BUSY_TEXT[mode]) : t(AUTH_SUBMIT_TEXT[mode])}
      </Button>
    </form>
  )
}
