import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel, FieldTitle, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ProductMark } from '@/components/product-mark'
import type { PortalViewModel } from '../hooks/use-portal.viewmodel'
import { ErrorView } from './state.view'
import { LanguageSelect } from './language-select.view'

export function AuthView({ vm }: { vm: PortalViewModel }) {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const hasEmail = vm.mode !== 'reset'
  const hasPassword = vm.mode !== 'forgot'
  const isLogin = vm.mode === 'login'

  const titles: Record<string, string> = {
    login: t('auth.titleLogin'),
    register: t('auth.titleRegister'),
    forgot: t('auth.titleForgot'),
    reset: t('auth.titleReset'),
  }

  const descriptions: Record<string, string> = {
    login: t('auth.descLogin'),
    register: t('auth.descRegister'),
    forgot: t('auth.descForgot'),
    reset: t('auth.descReset'),
  }

  const changeMode = (mode: string) => {
    setShowPassword(false)
    vm.changeMode(mode)
  }

  return (
    <FieldGroup
      role="main"
      data-testid="auth-view-container"
      className="mx-auto flex min-h-svh w-full max-w-none flex-col items-center justify-center gap-7 bg-background px-4 py-8 sm:gap-8 sm:px-6"
    >
      <CardHeader className="flex w-full max-w-md flex-col items-center gap-4 px-0 py-0 text-center">
        <FieldGroup className="w-full flex-row items-center justify-center gap-3">
          <ProductMark className="size-11" />
          <FieldDescription className="text-base font-medium text-foreground">
            {t('auth.brandName')}
          </FieldDescription>
        </FieldGroup>
        <FieldTitle
          role="heading"
          aria-level={1}
          className="text-2xl tracking-tight"
        >
          {vm.pendingInviteToken && isLogin ? t('invite.acceptTitle') : titles[vm.mode]}
        </FieldTitle>
        <FieldDescription className="max-w-sm text-base leading-relaxed">
          {vm.pendingInviteToken && isLogin
            ? t('invite.errorDescription')
            : descriptions[vm.mode]}
        </FieldDescription>
      </CardHeader>

      <Card className="w-full max-w-md gap-0 overflow-hidden rounded-lg py-0">
        <CardContent className="w-full p-5 sm:p-6">
          <FieldGroup className="gap-5">
            {hasEmail && (
              <Field className="gap-2">
                <FieldLabel htmlFor="email" className="text-sm font-medium">
                  {t('auth.emailLabel')}
                </FieldLabel>
                <Input
                  id="email"
                  data-testid="auth-email-input"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-11"
                  value={vm.email}
                  onChange={event => vm.setEmail(event.target.value)}
                />
              </Field>
            )}

            {hasPassword && (
              <Field className="gap-2">
                <FieldGroup className="flex-row flex-wrap items-center justify-between gap-2">
                  <FieldLabel htmlFor="password" className="text-sm font-medium">
                    {t('auth.passwordLabel')}
                  </FieldLabel>
                  {isLogin && (
                    <Button
                      type="button"
                      variant="link"
                      className="min-h-11 cursor-pointer px-2 py-1 text-sm font-normal"
                      data-testid="auth-mode-button"
                      onClick={() => changeMode('forgot')}
                    >
                      {t('auth.forgotPassword')}
                    </Button>
                  )}
                </FieldGroup>
                <FieldGroup className="relative gap-0">
                  <Input
                    id="password"
                    data-testid="auth-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={vm.mode === 'login' ? 'current-password' : 'new-password'}
                    className="h-11 pr-12"
                    value={vm.password}
                    onChange={event => vm.setPassword(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && vm.password && !vm.auth.isPending) vm.auth.mutate()
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-0 size-11 -translate-y-1/2 cursor-pointer"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-pressed={showPassword}
                    data-testid="auth-password-visibility-button"
                    onClick={() => setShowPassword(value => !value)}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </FieldGroup>
              </Field>
            )}

            {vm.auth.error && <ErrorView error={vm.auth.error} />}
            {vm.auth.isSuccess && (vm.mode === 'forgot' || vm.mode === 'reset') && (
              <CardDescription role="status" data-testid="auth-success-message">
                {vm.mode === 'forgot'
                  ? t('auth.resetSent')
                  : t('auth.passwordUpdated')}
              </CardDescription>
            )}
            <Button
              type="button"
              className="w-full cursor-pointer"
              data-testid="auth-submit-button"
              disabled={
                vm.auth.isPending ||
                (vm.mode !== 'reset' && !vm.email.includes('@')) ||
                (vm.mode !== 'forgot' && !vm.password)
              }
              onClick={() => vm.auth.mutate()}
            >
              {vm.auth.isPending
                ? t('common.pleaseWait')
                : vm.mode === 'login'
                  ? t('auth.submitLogin')
                  : vm.mode === 'register'
                    ? t('auth.submitRegister')
                    : vm.mode === 'forgot'
                      ? t('auth.submitForgot')
                      : t('auth.submitReset')}
            </Button>
          </FieldGroup>
        </CardContent>
        {!isLogin && (
          <CardFooter className="px-5 pt-0 pb-5 sm:px-6">
            <Button
              type="button"
              variant="link"
              className="min-h-11 cursor-pointer px-2 py-1"
              data-testid="auth-mode-button"
              onClick={() => changeMode('login')}
            >
              {t('auth.backToSignIn')}
            </Button>
          </CardFooter>
        )}
      </Card>
      <LanguageSelect className="w-44" />
    </FieldGroup>
  )
}
