import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldDescription, FieldGroup, FieldTitle } from '@/components/ui/field'
import { ProductMark } from '@/components/product-mark'
import type { DesktopLoginViewModel } from '../hooks/use-desktop-login.viewmodel'

export function DesktopLoginView({ email, vm }: { email: string; vm: DesktopLoginViewModel }) {
  const { t } = useTranslation()

  return (
    <FieldGroup
      role="main"
      data-testid="desktop-login-view"
      className="mx-auto flex min-h-svh w-full max-w-none flex-col items-center justify-center gap-7 bg-background px-4 py-8 sm:gap-8 sm:px-6"
    >
      <CardHeader className="flex w-full max-w-md flex-col items-center gap-4 px-0 py-0 text-center">
        <FieldGroup className="w-full flex-row items-center justify-center gap-3">
          <ProductMark className="size-11" />
          <FieldDescription className="text-base font-medium text-foreground">{t('auth.brandName')}</FieldDescription>
        </FieldGroup>
        <FieldTitle role="heading" aria-level={1} className="text-2xl tracking-tight">
          {t('desktop.title')}
        </FieldTitle>
        <FieldDescription className="max-w-sm text-base leading-relaxed">
          {t('desktop.signedInAs', { email })}
        </FieldDescription>
      </CardHeader>

      <Card className="w-full max-w-md gap-0 overflow-hidden rounded-lg py-0" data-testid="desktop-login-card">
        <CardHeader className="gap-1 p-5 sm:p-6">
          <CardTitle className="text-base">{t('desktop.cardTitle')}</CardTitle>
          <CardDescription>{t('desktop.cardDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 pt-0 sm:p-6 sm:pt-0">
          {vm.invalid && (
            <Alert variant="destructive" data-testid="desktop-login-invalid">
              <AlertDescription>{t('desktop.invalid')}</AlertDescription>
            </Alert>
          )}
          {vm.error && (
            <Alert variant="destructive" role="alert" data-testid="desktop-login-error">
              <AlertDescription>{vm.error}</AlertDescription>
            </Alert>
          )}
          {vm.isDone && (
            <Alert role="status" data-testid="desktop-login-done">
              <AlertDescription>{t('desktop.done')}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        {!vm.isDone && (
          <CardFooter className="flex-col gap-2 p-5 pt-0 sm:p-6 sm:pt-0">
            <Button
              className="h-11 w-full cursor-pointer"
              data-testid="desktop-login-approve-button"
              disabled={vm.isBusy || vm.invalid}
              onClick={vm.approve}
            >
              {vm.isBusy ? t('desktop.approving') : t('desktop.approve')}
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full cursor-pointer"
              data-testid="desktop-login-cancel-button"
              disabled={vm.isBusy}
              onClick={vm.cancel}
            >
              {t('common.cancel')}
            </Button>
          </CardFooter>
        )}
      </Card>
    </FieldGroup>
  )
}
