import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { WorkspaceListView, type WorkspaceListViewProps } from './workspace-list.view'

const baseProps: WorkspaceListViewProps = {
  status: 'ready',
  workspaces: [{ id: 'ws-1', name: 'Payments API', role: 'owner', headCommitId: null, createdAt: '2026-10-28T00:00:00Z', updatedAt: null }],
  errorMessage: null,
  onOpen: vi.fn(),
  onCreate: vi.fn(),
  onRetry: vi.fn(),
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('WorkspaceListView', () => {
  test('shows a skeleton while loading', () => {
    render(<WorkspaceListView {...baseProps} status="loading" workspaces={[]} />)
    expect(screen.getByTestId('workspaces-loading-state')).toBeInTheDocument()
  })

  test('shows the error state with a retry button', () => {
    const onRetry = vi.fn()
    render(<WorkspaceListView {...baseProps} status="error" workspaces={[]} errorMessage="Sign in is required." onRetry={onRetry} />)

    expect(screen.getByTestId('workspaces-error-state')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('workspaces-retry-button'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  test('shows the empty state with a create button', () => {
    const onCreate = vi.fn()
    render(<WorkspaceListView {...baseProps} status="empty" workspaces={[]} onCreate={onCreate} />)

    expect(screen.getByTestId('workspaces-empty-state')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('workspaces-empty-create-button'))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  test('opens a workspace when its row is clicked', () => {
    const onOpen = vi.fn()
    render(<WorkspaceListView {...baseProps} onOpen={onOpen} />)

    fireEvent.click(screen.getByTestId('workspaces-row-ws-1'))
    expect(onOpen).toHaveBeenCalledWith('ws-1')
  })
})
