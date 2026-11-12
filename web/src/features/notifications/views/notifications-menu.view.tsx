import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NOTIFICATIONS_TEXT } from '@/features/notifications/constants/notifications-text.constants'
import type { useNotificationsViewModel } from '@/features/notifications/viewmodels/use-notifications.viewmodel'
import { Button } from '@/shared/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/primitives/dropdown-menu'
import { cn } from '@/shared/utils/cn'

export type NotificationsMenuViewProps = ReturnType<typeof useNotificationsViewModel>

export function NotificationsMenuView(vm: NotificationsMenuViewProps) {
  const { t } = useTranslation('notifications')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative shrink-0"
            aria-label={t(NOTIFICATIONS_TEXT.open)}
            data-testid="notifications-menu-button"
          />
        }
      >
        <Bell />
        {vm.unreadCount > 0 && (
          <span
            data-testid="notifications-menu-badge"
            className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground"
          >
            {vm.unreadCount > 9 ? '9+' : vm.unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t(NOTIFICATIONS_TEXT.title)}</DropdownMenuLabel>
          {vm.error && <p className="px-2 py-1.5 text-sm text-destructive">{vm.error}</p>}
          {!vm.error && vm.items.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">{t(NOTIFICATIONS_TEXT.empty)}</p>}
          {vm.items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              data-testid={`notifications-menu-item-${item.id}`}
              className="items-start gap-2"
              onClick={() => vm.onOpen(item.id)}
            >
              <span
                aria-hidden="true"
                className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.unread ? 'bg-primary' : 'bg-transparent')}
              />
              <span className="grid min-w-0 gap-0.5">
                <span className={cn('text-sm', item.unread && 'font-medium')}>{item.text}</span>
                <span className="text-xs text-muted-foreground">{item.when}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {vm.unreadCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="notifications-menu-mark-all" onClick={vm.onMarkAllRead}>
              {t(NOTIFICATIONS_TEXT.markAll)}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
