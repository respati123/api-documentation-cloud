import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import '@/shared/i18n'
import { AppErrorBoundary } from '@/shared/errors/app-error-boundary'
import { useScrollActivity } from '@/shared/hooks/use-scroll-activity'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

export function AppProviders({ children }: { children: ReactNode }) {
  useScrollActivity()
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>{children}</AppErrorBoundary>
    </QueryClientProvider>
  )
}
