import { Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { DESKTOP_TEXT } from '../constants/desktop-login-text.constants'

export interface DesktopLoginViewProps {
  email: string
  isBusy: boolean
  isDone: boolean
  error: string | null
  onApprove: () => void
  onCancel: () => void
}

export function DesktopLoginView({ email, isBusy, isDone, error, onApprove, onCancel }: DesktopLoginViewProps) {
  const { t } = useTranslation('desktop')
  return (
    <main className="grid min-h-screen grid-cols-1 bg-background text-foreground md:grid-cols-[45%_1fr]">
      <section className="hidden flex-col justify-between border-r border-border bg-sidebar p-12 md:flex">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-md border border-primary bg-primary/30">
            <Layers className="size-4" />
          </span>
          <span>{t(DESKTOP_TEXT.brand.name)}</span>
        </div>
        <div className="grid gap-4">
          <h1 className="text-4xl font-semibold leading-tight">{t(DESKTOP_TEXT.brand.heading)}</h1>
          <p className="max-w-md text-sm text-muted-foreground">{t(DESKTOP_TEXT.brand.copy)}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t(DESKTOP_TEXT.brand.foot)}</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <Card className="w-full max-w-sm" data-testid="desktop-login-card">
          <CardHeader>
            <CardTitle>{t(DESKTOP_TEXT.title)}</CardTitle>
            <CardDescription>{t(DESKTOP_TEXT.subtitle, { email })}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {error && (
              <Alert variant="destructive" data-testid="desktop-login-error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {isDone && (
              <Alert role="status" data-testid="desktop-login-done">
                <AlertDescription>{t(DESKTOP_TEXT.done)}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          {!isDone && (
            <CardFooter className="flex-col gap-2">
              <Button className="w-full" data-testid="desktop-login-approve-button" disabled={isBusy} onClick={onApprove}>
                {isBusy ? t(DESKTOP_TEXT.approving) : t(DESKTOP_TEXT.approve)}
              </Button>
              <Button variant="outline" className="w-full" data-testid="desktop-login-cancel-button" disabled={isBusy} onClick={onCancel}>
                {t(DESKTOP_TEXT.cancel)}
              </Button>
            </CardFooter>
          )}
        </Card>
      </section>
    </main>
  )
}
