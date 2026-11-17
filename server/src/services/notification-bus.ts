// Lets the realtime layer hear about new notifications without every caller of notify() holding the app context.
export interface PushedNotification {
  id: string
  kind: string
  link: string
  data: Record<string, unknown>
  readAt: null
  createdAt: string
}

type Listener = (userId: string, notification: PushedNotification) => void

const listeners = new Set<Listener>()

export function onNotification(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishNotification(userId: string, notification: PushedNotification) {
  for (const listener of listeners) {
    try {
      listener(userId, notification)
    } catch {
      // A failing push must not fail the write that created the notification.
    }
  }
}
