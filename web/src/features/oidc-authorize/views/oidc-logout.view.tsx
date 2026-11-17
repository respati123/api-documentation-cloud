import { useTranslation } from 'react-i18next'
import { OIDC_LOGOUT_TEXT } from '@/features/oidc-authorize/constants/oidc-logout-text.constants'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/primitives/card'

export interface OidcLogoutViewProps {
  isWorking: boolean
  errorMessage: string | null
  onRetry: () => void
}

export function OidcLogoutView({ isWorking, errorMessage, onRetry }: OidcLogoutViewProps) {
  const { t } = useTranslation()
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-sm" data-testid="oidc-logout-card">
        <CardHeader>
          <CardTitle>{t(OIDC_LOGOUT_TEXT.title)}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {isWorking && !errorMessage && (
            <p className="text-sm text-muted-foreground" data-testid="oidc-logout-working">
              {t(OIDC_LOGOUT_TEXT.working)}
            </p>
          )}
          {errorMessage && (
            <>
              <Alert variant="destructive" data-testid="oidc-logout-error">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
              <Button className="w-full" data-testid="oidc-logout-retry-button" onClick={onRetry}>
                {t(OIDC_LOGOUT_TEXT.retry)}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
