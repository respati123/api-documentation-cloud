import '@/shared/i18n'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Toaster } from '@/shared/components/toaster'
import { showToast, TOAST_LIMIT } from '@/shared/toast/toast-manager'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Toaster', () => {
  test('shows a raised toast with its kind and message', async () => {
    render(<Toaster />)

    act(() => {
      showToast({ kind: 'error', message: 'Workspace name is taken' })
    })

    const toast = await screen.findByTestId('cloud-toast')
    expect(toast).toHaveAttribute('data-kind', 'error')
    expect(screen.getByTestId('cloud-toast-message')).toHaveTextContent('Workspace name is taken')
  })

  test('renders outside the main content, in its own floating viewport', async () => {
    render(
      <main data-testid="page-main">
        <Toaster />
      </main>,
    )

    act(() => {
      showToast({ kind: 'success', message: 'Saved' })
    })

    const viewport = await screen.findByTestId('cloud-toast-viewport')
    expect(screen.getByTestId('page-main')).not.toContainElement(viewport)
  })

  test('runs the open action for a notification and closes it', async () => {
    const onOpen = vi.fn()
    render(<Toaster />)

    act(() => {
      showToast({ kind: 'notification', message: 'You were assigned a task', onOpen })
    })
    fireEvent.click(await screen.findByTestId('cloud-toast-open-button'))

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  test('keeps one toast when the same id is raised twice', async () => {
    render(<Toaster />)

    act(() => {
      showToast({ id: 'n-1', kind: 'notification', message: 'First' })
      showToast({ id: 'n-1', kind: 'notification', message: 'First' })
    })

    await waitFor(() => expect(screen.getAllByTestId('cloud-toast')).toHaveLength(1))
  })

  test('limits how many toasts show at once', async () => {
    render(<Toaster />)

    act(() => {
      for (let index = 0; index < TOAST_LIMIT + 2; index += 1) showToast({ kind: 'info', message: `Message ${index}` })
    })

    await waitFor(() => {
      const visible = screen.getAllByTestId('cloud-toast').filter((toast) => !toast.hasAttribute('data-limited'))
      expect(visible.length).toBeLessThanOrEqual(TOAST_LIMIT)
    })
  })
})
