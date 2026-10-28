import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
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

const switchTargets: Partial<Record<AuthMode, { prompt: string; target: AuthMode; label: string }>> = {
  login: { prompt: 'switch.newHere', target: 'register', label: 'switch.createAccount' },
  register: { prompt: 'switch.haveAccount', target: 'login', label: 'switch.signIn' },
  forgot: { prompt: 'switch.remembered', target: 'login', label: 'switch.backToSignIn' },
}

export function AuthView({ mode, isBusy, errorMessage, noticeMessage, inviteMessage, onModeChange, onSubmit }: AuthViewProps) {
  const { t } = useTranslation('auth')
  const isStrongPassword = mode === 'register' || mode === 'reset'
  const switchTarget = switchTargets[mode]

  return (
    <main data-testid="auth-view-container" className="grid min-h-screen grid-cols-1 bg-background text-foreground md:grid-cols-[45%_1fr]">
      <section className="hidden flex-col justify-between border-r border-border bg-sidebar p-12 md:flex">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <ProductMark />
          <span>{t('brand.name')}</span>
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-xs tracking-widest text-muted-foreground">{t('brand.kicker')}</p>
          <h1 className="text-4xl font-semibold leading-tight">{t('brand.title')}</h1>
          <p className="max-w-md text-sm text-muted-foreground">{t('brand.copy')}</p>
          <ModelDiagram />
        </div>
        <p className="text-xs text-muted-foreground">{t('brand.foot')}</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <p className="mb-3 text-[10px] tracking-widest text-muted-foreground">{t('eyebrow')}</p>
          <h2 className="text-2xl font-semibold">{t(`heading.${mode}`)}</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">{t(`subtitle.${mode}`)}</p>

          {inviteMessage && (
            <div data-testid="auth-invite-note" role="status" className="mb-4 rounded-md border border-border bg-accent p-3 text-xs">
              {inviteMessage}
            </div>
          )}
          {noticeMessage && (
            <div data-testid="auth-notice" role="status" className="mb-4 rounded-md border border-border bg-accent p-3 text-xs">
              {noticeMessage}
            </div>
          )}

          <form data-testid="auth-form" className="grid gap-4" onSubmit={onSubmit}>
            {mode !== 'reset' && (
              <div className="grid gap-2">
                <Label htmlFor="auth-email">{t('field.email')}</Label>
                <Input
                  id="auth-email"
                  name="email"
                  data-testid="auth-email-input"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  maxLength={254}
                  placeholder={t('placeholder.email')}
                />
              </div>
            )}
            {mode !== 'forgot' && (
              <div className="grid gap-2">
                <Label htmlFor="auth-password">{mode === 'reset' ? t('field.newPassword') : t('field.password')}</Label>
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
                  placeholder={isStrongPassword ? t('placeholder.newPassword') : t('placeholder.password')}
                />
                {isStrongPassword && <p className="text-xs text-muted-foreground">{t('hint')}</p>}
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
                  {t('forgot')}
                </Button>
              </p>
            )}
            {errorMessage && (
              <p data-testid="auth-error-message" role="alert" className="text-xs text-destructive">
                {errorMessage}
              </p>
            )}
            <Button type="submit" data-testid="auth-submit-button" className="h-11 w-full" disabled={isBusy}>
              {isBusy ? t(`busy.${mode}`) : t(`submit.${mode}`)}
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
          <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">{t('localNote')}</p>
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
        <span className="size-3 rounded-sm border border-muted-foreground" aria-hidden="true" />
        {t('model.workspace')}
      </div>
      <div className="flex items-center gap-2 pl-4">
        <span className="size-3 rounded-sm border border-muted-foreground" aria-hidden="true" />
        {t('model.collection')}
      </div>
      <div className="flex items-center gap-2 pl-8">
        <span className="rounded border border-ring px-1 text-[10px] font-semibold text-ring">GET</span>
        {t('model.request')}
      </div>
      <div className="flex items-center gap-2 pl-12">
        <span className="size-2 rounded-full border border-muted-foreground" aria-hidden="true" />
        {t('model.contract')}
      </div>
    </div>
  )
}
