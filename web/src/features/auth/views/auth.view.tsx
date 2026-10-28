import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/components/ui/field'
import { Input } from '@/shared/components/ui/input'
import { Separator } from '@/shared/components/ui/separator'
import {
  AUTH_BUSY_TEXT,
  AUTH_HEADING_TEXT,
  AUTH_PREVIEW_ROWS,
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
    <main
      data-testid="auth-view-container"
      className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
    >
      <BrandPanel />

      <section className="flex flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mx-auto grid w-full max-w-sm gap-8">
          <div className="flex items-center gap-3 lg:hidden">
            <ProductMark />
            <span className="text-sm font-semibold">{t(AUTH_TEXT.brand.name)}</span>
          </div>

          <header className="grid gap-2">
            <h2 className="text-3xl font-semibold tracking-tight">{t(AUTH_HEADING_TEXT[mode])}</h2>
            <p className="text-sm text-muted-foreground">{t(AUTH_SUBTITLE_TEXT[mode])}</p>
          </header>

          {inviteMessage && (
            <Alert data-testid="auth-invite-note" role="status">
              <AlertDescription>{inviteMessage}</AlertDescription>
            </Alert>
          )}
          {noticeMessage && (
            <Alert data-testid="auth-notice" role="status">
              <AlertDescription>{noticeMessage}</AlertDescription>
            </Alert>
          )}

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
                    className="h-11"
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
                        className="h-auto p-0 text-xs"
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
                    autoComplete={isStrongPassword ? 'new-password' : 'current-password'}
                    autoFocus={mode === 'reset'}
                    required
                    minLength={isStrongPassword ? 10 : 1}
                    maxLength={256}
                    placeholder={isStrongPassword ? t(AUTH_TEXT.placeholder.newPassword) : t(AUTH_TEXT.placeholder.password)}
                    className="h-11"
                  />
                  {isStrongPassword && <FieldDescription>{t(AUTH_TEXT.hint)}</FieldDescription>}
                </Field>
              )}
            </FieldGroup>

            {errorMessage && (
              <Alert variant="destructive" data-testid="auth-error-message">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" data-testid="auth-submit-button" className="h-11 w-full text-sm" disabled={isBusy}>
              {isBusy ? t(AUTH_BUSY_TEXT[mode]) : t(AUTH_SUBMIT_TEXT[mode])}
            </Button>
          </form>

          {switchTarget && (
            <p className="flex flex-wrap items-center justify-center gap-x-1 text-sm text-muted-foreground">
              {t(switchTarget.prompt)}
              <Button
                type="button"
                variant="link"
                data-testid="auth-switch-button"
                className="h-auto p-0 text-sm"
                onClick={() => onModeChange(switchTarget.target)}
              >
                {t(switchTarget.label)}
              </Button>
            </p>
          )}

          <Separator />
          <p className="text-xs text-muted-foreground">{t(AUTH_TEXT.localNote)}</p>
        </div>
      </section>
    </main>
  )
}

function BrandPanel() {
  const { t } = useTranslation('auth')
  return (
    <section className="hidden flex-col justify-between gap-12 border-r border-border bg-sidebar p-12 lg:flex">
      <div className="flex items-center gap-3 text-sm font-semibold">
        <ProductMark />
        <span>{t(AUTH_TEXT.brand.name)}</span>
      </div>

      <div className="grid gap-6">
        <h1 className="max-w-md text-4xl leading-tight font-semibold tracking-tight">{t(AUTH_TEXT.brand.title)}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t(AUTH_TEXT.brand.copy)}</p>
        <Card size="sm" data-testid="auth-preview-board" className="max-w-md">
          <CardHeader>
            <CardTitle className="text-sm">{t(AUTH_TEXT.preview.title)}</CardTitle>
            <CardDescription>{t(AUTH_TEXT.preview.footer)}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid divide-y divide-border">
              {AUTH_PREVIEW_ROWS.map((row) => (
                <li
                  key={`${row.method}-${row.path}-${row.name}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2.5"
                >
                  <Badge variant={row.method === 'GET' ? 'secondary' : 'default'} className="font-mono">
                    {row.method}
                  </Badge>
                  <span className="grid min-w-0">
                    <span className="truncate text-sm font-medium">{t(row.name)}</span>
                    <code className="truncate text-xs text-muted-foreground">{row.path}</code>
                  </span>
                  <Badge variant={row.status === AUTH_TEXT.preview.pending ? 'outline' : 'secondary'} className="tabular-nums">
                    {t(row.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">{t(AUTH_TEXT.brand.foot)}</p>
    </section>
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
