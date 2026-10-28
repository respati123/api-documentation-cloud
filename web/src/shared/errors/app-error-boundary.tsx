import { QueryErrorResetBoundary } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={reset} onError={logError}>
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}

function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  const { t } = useTranslation('common')
  return (
    <div role="alert" data-testid="app-error-fallback" className="flex min-h-screen items-center justify-center p-6">
      <Alert className="max-w-md">
        <AlertTitle>{t('error.title')}</AlertTitle>
        <AlertDescription>
          <p>{t('error.detail')}</p>
          <div className="mt-4 flex gap-2">
            <Button data-testid="app-error-retry-button" onClick={resetErrorBoundary}>
              {t('error.retry')}
            </Button>
            <Button variant="outline" data-testid="app-error-back-button" onClick={() => window.location.assign('/workspaces')}>
              {t('error.back')}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}

function logError(error: unknown) {
  console.error(error)
}
