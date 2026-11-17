// OIDC clients and OAuth tools expect a plain JSON body, not the { code, requestId, data } wrapper used by the rest of the API.
// Only the OIDC routes use this helper.
export function oidcJson(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers })
}

export const noStoreHeaders = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }
