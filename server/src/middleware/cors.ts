const allowedMethods = 'GET, POST, PATCH, DELETE, OPTIONS'
const allowedHeaders = 'Authorization, Content-Type, Accept-Language, X-Request-Id'

export function corsHeaders(origin: string | null, allowedOrigins: readonly string[]): Headers {
  const headers = new Headers({ Vary: 'Origin' })
  if (origin && allowedOrigins.includes(origin)) headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

export function preflightResponse(origin: string | null, allowedOrigins: readonly string[]): Response {
  const headers = corsHeaders(origin, allowedOrigins)
  if (!headers.has('Access-Control-Allow-Origin')) return new Response(null, { status: 403, headers })
  headers.set('Access-Control-Allow-Methods', allowedMethods)
  headers.set('Access-Control-Allow-Headers', allowedHeaders)
  headers.set('Access-Control-Max-Age', '600')
  return new Response(null, { status: 204, headers })
}
