export interface SecurityHeaderOptions {
  requestId: string
  sensitive: boolean
}

export function securityHeaders({ requestId, sensitive }: SecurityHeaderOptions): Headers {
  const headers = new Headers({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Request-Id': requestId,
  })
  if (sensitive) headers.set('Cache-Control', 'no-store')
  return headers
}
