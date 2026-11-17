import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/shared/components/language-switcher'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { AUTH_HEADING_TEXT, AUTH_SUBTITLE_TEXT, AUTH_SWITCH_TEXT, AUTH_TEXT } from '../constants/auth-text.constants'
import type { AuthMode } from '../models/auth.model'
import { AuthBrandPanel, ProductMark } from './auth-brand.view'
import { AuthForm } from './auth-form.view'

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
  const switchTarget = AUTH_SWITCH_TEXT[mode]

  return (
    <main
      data-testid="auth-view-container"
      className="auth-theme grid min-h-screen bg-background lg:h-dvh lg:overflow-hidden text-foreground lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
    >
      <AuthBrandPanel />

      <section className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto grid w-full max-w-sm gap-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 lg:hidden">
              <ProductMark />
              <span className="text-sm font-bold">{t(AUTH_TEXT.brand.name)}</span>
            </div>
            <div className="ml-auto">
              <LanguageSwitcher />
            </div>
          </div>

          <header className="grid gap-3">
            <h2 className="font-display text-4xl leading-[1.05] font-bold text-balance uppercase">{t(AUTH_HEADING_TEXT[mode])}</h2>
            <p className="text-base text-muted-foreground">{t(AUTH_SUBTITLE_TEXT[mode])}</p>
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

          <AuthForm mode={mode} isBusy={isBusy} errorMessage={errorMessage} onModeChange={onModeChange} onSubmit={onSubmit} />

          {switchTarget && (
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              {t(switchTarget.prompt)}
              <Button
                type="button"
                variant="link"
                data-testid="auth-switch-button"
                className="h-auto p-0 text-sm text-link underline underline-offset-4"
                onClick={() => onModeChange(switchTarget.target)}
              >
                {t(switchTarget.label)}
              </Button>
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
