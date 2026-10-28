import { Circle, Folder } from 'lucide-react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  AUTH_BUSY_TEXT,
  AUTH_HEADING_TEXT,
  AUTH_PREVIEW_METHOD,
  AUTH_SUBMIT_TEXT,
  AUTH_SUBTITLE_TEXT,
  AUTH_SWITCH_TEXT,
  AUTH_TEXT,
} from '../constants/auth-text.constants'
import type { AuthMode } from '../models/auth.model'

export interface AuthViewProps {
  mode: AuthMode
  isBusy: boolean
  errorMessage: string | null
  noticeMessage: string | null
  inviteMessage: string | null
  onModeChange: (mode: AuthMode) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function AuthView({ mode, isBusy, errorMessage, noticeMessage, inviteMessage, onModeChange, onSubmit }: AuthViewProps) {
  const { t } = useTranslation('auth')
  const isStrongPassword = mode === 'register' || mode === 'reset'
  const switchTarget = AUTH_SWITCH_TEXT[mode]

  return (
    <main data-testid="auth-view-container" className="grid min-h-screen grid-cols-1 bg-background text-foreground md:grid-cols-[45%_1fr]">
      <section className="hidden flex-col justify-between border-r border-border bg-sidebar p-12 md:flex">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <ProductMark />
          <span>{t(AUTH_TEXT.brand.name)}</span>
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold leading-tight">{t(AUTH_TEXT.brand.title)}</h1>
          <p className="max-w-md text-sm text-muted-foreground">{t(AUTH_TEXT.brand.copy)}</p>
          <ModelDiagram />
        </div>
        <p className="text-xs text-muted-foreground">{t(AUTH_TEXT.brand.foot)}</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">{t(AUTH_HEADING_TEXT[mode])}</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">{t(AUTH_SUBTITLE_TEXT[mode])}</p>

          {inviteMessage && (
            <Alert data-testid="auth-invite-note" role="status" className="mb-4">
              <AlertDescription>{inviteMessage}</AlertDescription>
            </Alert>
          )}
          {noticeMessage && (
            <Alert data-testid="auth-notice" role="status" className="mb-4">
              <AlertDescription>{noticeMessage}</AlertDescription>
            </Alert>
          )}

          <form data-testid="auth-form" className="grid gap-4" onSubmit={onSubmit}>
            {mode !== 'reset' && (
              <div className="grid gap-2">
                <Label htmlFor="auth-email">{t(AUTH_TEXT.field.email)}</Label>
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
                />
              </div>
            )}
            {mode !== 'forgot' && (
              <div className="grid gap-2">
                <Label htmlFor="auth-password">{mode === 'reset' ? t(AUTH_TEXT.field.newPassword) : t(AUTH_TEXT.field.password)}</Label>
                <Input
                  id="auth-password"
                  name="password"
                  data-testid="auth-password-input"
                  type="password"
                  autoComplete={isStrongPassword ? 'new-password' : 'current-password'}
                  autoFocus={mode === 'reset'}
                  required
                  minLength={isStrongPassword ? 10 : 1}
                  maxLength={256}
                  placeholder={isStrongPassword ? t(AUTH_TEXT.placeholder.newPassword) : t(AUTH_TEXT.placeholder.password)}
                />
                {isStrongPassword && <p className="text-xs text-muted-foreground">{t(AUTH_TEXT.hint)}</p>}
              </div>
            )}
            {mode === 'login' && (
              <p className="-mt-2 text-right">
                <Button
                  type="button"
                  variant="link"
                  data-testid="auth-forgot-button"
                  className="h-auto p-0 text-xs text-ring"
                  onClick={() => onModeChange('forgot')}
                >
                  {t(AUTH_TEXT.forgot)}
                </Button>
              </p>
            )}
            {errorMessage && (
              <Alert variant="destructive" data-testid="auth-error-message">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" data-testid="auth-submit-button" className="h-11 w-full" disabled={isBusy}>
              {isBusy ? t(AUTH_BUSY_TEXT[mode]) : t(AUTH_SUBMIT_TEXT[mode])}
            </Button>
          </form>

          {switchTarget && (
            <p className="mt-6 text-xs text-muted-foreground">
              {t(switchTarget.prompt)}{' '}
              <Button
                type="button"
                variant="link"
                data-testid="auth-switch-button"
                className="h-auto p-0 text-xs text-ring"
                onClick={() => onModeChange(switchTarget.target)}
              >
                {t(switchTarget.label)}
              </Button>
            </p>
          )}
          <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">{t(AUTH_TEXT.localNote)}</p>
        </div>
      </section>
    </main>
  )
}

function ProductMark() {
  return (
    <span
      className="flex size-9 flex-col items-center justify-center gap-1 rounded-md border border-primary bg-primary/30"
      aria-hidden="true"
    >
      <span className="h-px w-4 bg-foreground" />
      <span className="h-px w-3 bg-foreground" />
      <span className="h-px w-4 bg-foreground" />
    </span>
  )
}

function ModelDiagram() {
  const { t } = useTranslation('auth')
  return (
    <div data-testid="auth-model-diagram" className="mt-6 flex max-w-sm flex-col gap-3 rounded-md border border-border bg-card p-4 text-xs">
      <div className="flex items-center gap-2">
        <Folder aria-hidden="true" className="size-3.5 text-muted-foreground" />
        {t(AUTH_TEXT.model.workspace)}
      </div>
      <div className="flex items-center gap-2 pl-4">
        <Folder aria-hidden="true" className="size-3.5 text-muted-foreground" />
        {t(AUTH_TEXT.model.collection)}
      </div>
      <div className="flex items-center gap-2 pl-8">
        <Badge variant="outline" className="text-ring">
          {AUTH_PREVIEW_METHOD}
        </Badge>
        {t(AUTH_TEXT.model.request)}
      </div>
      <div className="flex items-center gap-2 pl-12">
        <Circle aria-hidden="true" className="size-2.5 text-muted-foreground" />
        {t(AUTH_TEXT.model.contract)}
      </div>
    </div>
  )
}
