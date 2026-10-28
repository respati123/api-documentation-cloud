// The page size the portal asks for. The server accepts 1 to 100.
export const PAGE_SIZE = 50

export function pageQuery(cursor: string | null): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
  if (cursor !== null) params.set('cursor', cursor)
  return `?${params.toString()}`
}
