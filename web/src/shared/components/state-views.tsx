import type { ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/components/ui/empty'
import { Skeleton } from '@/shared/components/ui/skeleton'

export function LoadingState({ label, testId }: { label: string; testId?: string }) {
  return (
    <div data-testid={testId} role="status" aria-live="polite" className="grid gap-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export function ErrorState({
  title,
  message,
  retryLabel,
  onRetry,
  testId,
}: {
  title: string
  message: string
  retryLabel: string
  onRetry: () => void
  testId?: string
}) {
  return (
    <Alert variant="destructive" data-testid={testId}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      <Button variant="outline" size="sm" className="mt-2 justify-self-start" onClick={onRetry}>
        {retryLabel}
      </Button>
    </Alert>
  )
}

export function EmptyState({ title, detail, action, testId }: { title: string; detail: string; action?: ReactNode; testId?: string }) {
  return (
    <Empty data-testid={testId} className="border border-dashed border-border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{detail}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}
