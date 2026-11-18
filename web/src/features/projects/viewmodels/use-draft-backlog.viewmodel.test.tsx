import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '@/shared/i18n'
import { useAuthSessionStore } from '@/features/auth'
import { issuesService } from '@/features/projects/services/issues.service'
import { useDraftBacklogViewModel } from '@/features/projects/viewmodels/use-draft-backlog.viewmodel'
import { ApiError } from '@/shared/services/api-client'
import { showToast } from '@/shared/toast/toast-manager'

vi.mock('@/features/projects/services/issues.service', () => ({ issuesService: { draftBacklog: vi.fn() } }))
vi.mock('@/shared/toast/toast-manager', () => ({ showToast: vi.fn() }))

let client: QueryClient
const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

beforeEach(async () => {
  await i18next.changeLanguage('en')
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthSessionStore.setState({ signedIn: true, userId: 'me', token: 't' })
})
afterEach(() => vi.clearAllMocks())

describe('useDraftBacklogViewModel', () => {
  test('creates the drafts, says so, and takes the person to the backlog', async () => {
    vi.mocked(issuesService.draftBacklog).mockResolvedValue([])
    const onDone = vi.fn()
    const { result } = renderHook(() => useDraftBacklogViewModel('w1', 'p1', true, onDone), { wrapper: Wrapper })
    act(() => result.current.run('d1'))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(issuesService.draftBacklog).toHaveBeenCalledWith('t', 'w1', 'p1', 'd1')
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
    expect(result.current.error).toBeNull()
  })

  test('shows the words of the server when the PRD is refused', async () => {
    vi.mocked(issuesService.draftBacklog).mockRejectedValue(new ApiError('The PRD is not approved.', 409, { code: 'X' }))
    const onDone = vi.fn()
    const { result } = renderHook(() => useDraftBacklogViewModel('w1', 'p1', true, onDone), { wrapper: Wrapper })
    act(() => result.current.run('d1'))
    await waitFor(() => expect(result.current.error).toBe('The PRD is not approved.'))
    expect(onDone).not.toHaveBeenCalled()
  })

  test('does nothing for someone who may not run it', () => {
    const { result } = renderHook(() => useDraftBacklogViewModel('w1', 'p1', false, vi.fn()), { wrapper: Wrapper })
    expect(result.current.canRun).toBe(false)
    act(() => result.current.run('d1'))
    expect(issuesService.draftBacklog).not.toHaveBeenCalled()
  })
})
