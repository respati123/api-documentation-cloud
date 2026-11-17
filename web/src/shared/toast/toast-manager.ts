import { Toast } from '@base-ui/react/toast'

export type ToastKind = 'success' | 'error' | 'info' | 'notification'

export interface ToastInput {
  // Raising a toast with an id already on screen updates that toast instead of adding another.
  id?: string
  kind: ToastKind
  message: string
  title?: string
  // Clicking the toast body runs this, for example to open a notification's link.
  onOpen?: () => void
}

export interface ToastData {
  onOpen?: () => void
}

export const TOAST_LIMIT = 4

const TOAST_TIMEOUT_MS: Record<ToastKind, number> = {
  success: 5000,
  info: 5000,
  notification: 8000,
  error: 8000,
}

// One manager for the whole app, so viewmodels and stores can raise a toast without a React context.
export const toastManager = Toast.createToastManager<ToastData>()

export function showToast({ id, kind, message, title, onOpen }: ToastInput): string {
  return toastManager.add({
    id,
    type: kind,
    title,
    description: message,
    timeout: TOAST_TIMEOUT_MS[kind],
    priority: kind === 'error' ? 'high' : 'low',
    data: { onOpen },
  })
}
