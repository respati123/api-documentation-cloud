import type { SQL } from 'bun'
import { type CursorKeys, cursorValues, encodeCursor, pageOf } from '@/lib/pagination'
import { listAllWorkspacesPage } from '@/repositories/workspaces.repository'
import { requireAdmin } from '@/services/admin'

export async function listWorkspacesForAdmin(db: SQL, adminId: string, search: string, limit: number, cursor: CursorKeys | null) {
  await requireAdmin(db, adminId)
  const after = cursorValues(cursor, ['sortAt', 'id'])
  const rows = await listAllWorkspacesPage(db, { search: search.trim().slice(0, 254), after, limit: limit + 1 })
  const page = pageOf(rows, limit, (row) => encodeCursor({ sortAt: row.sortAt, id: row.id }))
  return { items: page.items.map(({ sortAt: _sortAt, ...row }) => row), nextCursor: page.nextCursor }
}
