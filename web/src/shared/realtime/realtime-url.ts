// Doubles from one second and stops at thirty seconds.
export function reconnectDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 30_000)
}

// The API base comes from VITE_API_URL. When it is empty, the page origin is used, and nginx forwards /api.
export function socketUrl(apiBase: string, location: { protocol: string; host: string }, ticket: string): string {
  const base = apiBase ? new URL(apiBase) : null
  const protocol = base ? base.protocol : location.protocol
  const host = base ? base.host : location.host
  const scheme = protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${host}/api/sync/events?ticket=${encodeURIComponent(ticket)}`
}
