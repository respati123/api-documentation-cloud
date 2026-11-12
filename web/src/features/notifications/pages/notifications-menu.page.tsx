import { useNotificationsViewModel } from '@/features/notifications/viewmodels/use-notifications.viewmodel'
import { NotificationsMenuView } from '@/features/notifications/views/notifications-menu.view'

export function NotificationsMenu({ onOpenLink }: { onOpenLink: (link: string) => void }) {
  const vm = useNotificationsViewModel(onOpenLink)
  return <NotificationsMenuView {...vm} />
}
