import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

export function LoadingView() {
  const { t } = useTranslation()
  return <Skeleton data-testid="portal-loading-state" className="h-32 w-full" aria-label={t('common.loading')} />
}

export function ErrorView({
  error,
  retry,
  testId = 'portal-error-state',
  retryTestId,
}: {
  error: Error
  retry?: () => void
  testId?: string
  retryTestId?: string
}) {
  const { t } = useTranslation()
  const retryId = retryTestId ?? (testId === 'portal-error-state' ? 'portal-retry-button' : `${testId}-retry-button`)

  return (
    <Alert variant="destructive" role="alert" data-testid={testId}>
      <AlertTitle>{t('common.actionFailed')}</AlertTitle>
      <AlertDescription>
        {error.message}
        {retry && (
          <Button variant="outline" onClick={retry} data-testid={retryId}>
            {t('common.tryAgain')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

export function EmptyView({
  title,
  description,
  testId = 'portal-empty-state',
}: {
  title: string
  description: string
  testId?: string
}) {
  return (
    <Empty data-testid={testId}>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
