import { corsHeaders } from './cors'
import { securityHeaders } from './security-headers'

export interface ResponseHeaderOptions {
  requestId: string
  origin: string | null
  allowedOrigins: readonly string[]
  sensitive: boolean
}

const sensitivePrefixes = ['/api/auth/', '/api/desktop-login/']
const sensitivePaths = new Set(['/api/me', '/api/sync/events-ticket'])
const sensitiveInvitePath = /^\/api\/workspaces\/[^/]+\/invites$/

export function withResponseHeaders(response: Response, options: ResponseHeaderOptions): Response {
  const headers = new Headers(response.headers)
  const extra = new Headers([
    ...securityHeaders({ requestId: options.requestId, sensitive: options.sensitive }),
    ...corsHeaders(options.origin, options.allowedOrigins),
  ])
  for (const [name, value] of extra) {
    if (name === 'vary') headers.append('Vary', value)
    else headers.set(name, value)
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export function isSensitivePath(path: string): boolean {
  return sensitivePaths.has(path) || sensitivePrefixes.some((prefix) => path.startsWith(prefix)) || sensitiveInvitePath.test(path)
}
