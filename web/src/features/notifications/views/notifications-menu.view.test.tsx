import '@/shared/i18n'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { NotificationsMenuView } from '@/features/notifications/views/notifications-menu.view'

afterEach(() => {
  cleanup()
})

describe('NotificationsMenuView', () => {
  test('shows the unread count on the bell', () => {
    render(<NotificationsMenuView unreadCount={3} items={[]} error={null} onOpen={vi.fn()} onMarkAllRead={vi.fn()} />)

    expect(screen.getByTestId('notifications-menu-badge')).toHaveTextContent('3')
  })

  test('hides the badge when everything is read', () => {
    render(<NotificationsMenuView unreadCount={0} items={[]} error={null} onOpen={vi.fn()} onMarkAllRead={vi.fn()} />)

    expect(screen.queryByTestId('notifications-menu-badge')).not.toBeInTheDocument()
  })
})
