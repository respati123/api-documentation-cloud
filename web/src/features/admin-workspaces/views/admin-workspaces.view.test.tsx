import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AdminWorkspacesView, type AdminWorkspacesViewProps } from '@/features/admin-workspaces/views/admin-workspaces.view'

const baseProps: AdminWorkspacesViewProps = {
  search: '',
  setSearch: vi.fn(),
  workspaces: [
    { id: 'w-1', name: 'Contoh Proyek', ownerEmail: 'owner@contoh.test', memberCount: 7, createdAt: '2026-11-12T00:00:00.000Z' },
  ],
  status: 'ready',
  hasMore: false,
  isLoadingMore: false,
  loadMore: vi.fn(),
  error: null,
}

afterEach(() => {
  cleanup()
})

describe('AdminWorkspacesView', () => {
  test('each workspace shows its owner and member count', () => {
    render(<AdminWorkspacesView {...baseProps} />)

    const row = screen.getByTestId('admin-workspaces-row-w-1')
    expect(row).toHaveTextContent('Contoh Proyek')
    expect(row).toHaveTextContent('owner@contoh.test')
    expect(row).toHaveTextContent('7')
  })

  test('typing in the search box updates the search', () => {
    const setSearch = vi.fn()
    render(<AdminWorkspacesView {...baseProps} setSearch={setSearch} />)

    fireEvent.change(screen.getByTestId('admin-workspaces-search'), { target: { value: 'contoh' } })

    expect(setSearch).toHaveBeenCalledWith('contoh')
  })

  test('an empty list says there are no workspaces', () => {
    render(<AdminWorkspacesView {...baseProps} status="empty" workspaces={[]} />)

    expect(screen.getByTestId('admin-workspaces-table')).not.toHaveTextContent('Contoh Proyek')
  })
})
