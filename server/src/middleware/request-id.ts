const safeRequestId = /^[A-Za-z0-9_-]{1,64}$/

export function resolveRequestId(header: string | null): string {
  return header && safeRequestId.test(header) ? header : crypto.randomUUID()
}
