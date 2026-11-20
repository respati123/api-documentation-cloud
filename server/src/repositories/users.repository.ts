import type { SQL } from 'bun'
import type { AuthUser } from '@/models/workspace'

export interface UserCredentials extends AuthUser {
  passwordHash: string
}

export interface AdminUserRow {
  id: string
  email: string
  isAdmin: boolean
  roles: string[]
  createdAt: Date
  sortAt: string
}

export interface RoleMasterRow {
  id: string
  name: string
}

// Returns false when the email is already taken.
export async function insertUser(db: SQL, user: { id: string; email: string; passwordHash: string }): Promise<boolean> {
  const rows = await db`INSERT INTO users (id, email, password_hash) VALUES (${user.id}, ${user.email}, ${user.passwordHash}) ON CONFLICT (email) DO NOTHING RETURNING id`
  return rows.length === 1
}

export async function findUserByEmail(db: SQL, email: string): Promise<UserCredentials | undefined> {
  const [row] = await db`SELECT id, email, password_hash AS "passwordHash" FROM users WHERE email = ${email}`
  return row
}

export async function userEmailExists(db: SQL, email: string): Promise<boolean> {
  const [row] = await db`SELECT 1 FROM users WHERE lower(email) = ${email}`
  return row !== undefined
}

export async function findUserById(db: SQL, id: string): Promise<AuthUser | undefined> {
  const [row] = await db`SELECT id, email FROM users WHERE id = ${id}`
  return row
}

export async function listUsersPage(db: SQL, query: { search: string; after: { sortAt: string; id: string } | null; limit: number }): Promise<AdminUserRow[]> {
  const pattern = `%${query.search}%`
  const afterAt = query.after?.sortAt ?? null
  const afterId = query.after?.id ?? null
  return db`SELECT * FROM (SELECT u.id, u.email, u.is_admin AS "isAdmin", COALESCE(array_agg(ur.role_id ORDER BY r.sort_order) FILTER (WHERE ur.role_id IS NOT NULL), '{}') AS roles, u.created_at AS "createdAt", u.created_at::text AS "sortAt" FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN role_master r ON r.id = ur.role_id WHERE u.email ILIKE ${pattern} GROUP BY u.id) q WHERE ${afterAt}::text IS NULL OR (q."sortAt"::timestamptz, q.id) < (${afterAt}::timestamptz, ${afterId}::text) ORDER BY q."sortAt"::timestamptz DESC, q.id DESC LIMIT ${query.limit}`
}

export async function countUsersMatching(db: SQL, search: string): Promise<number> {
  const pattern = `%${search}%`
  const [row] = await db`SELECT count(*)::int AS total FROM users WHERE email ILIKE ${pattern}`
  return row.total
}

export async function listRoleMaster(db: SQL): Promise<RoleMasterRow[]> {
  return db`SELECT id, name FROM role_master ORDER BY sort_order, id`
}

export async function insertRoleMaster(db: SQL, role: RoleMasterRow): Promise<RoleMasterRow | undefined> {
  const [row] = await db`INSERT INTO role_master (id, name, sort_order) SELECT ${role.id}, ${role.name}, COALESCE(MAX(sort_order), 0) + 1 FROM role_master ON CONFLICT DO NOTHING RETURNING id, name`
  return row
}

export async function deleteRoleMaster(db: SQL, roleId: string): Promise<'deleted' | 'in_use' | 'not_found'> {
  return db.begin(async (tx): Promise<'deleted' | 'in_use' | 'not_found'> => {
    const [role] = await tx`SELECT id FROM role_master WHERE id = ${roleId} FOR UPDATE`
    if (!role) return 'not_found'
    const [assignment] = await tx`SELECT 1 FROM user_roles WHERE role_id = ${roleId} LIMIT 1`
    if (assignment) return 'in_use'
    await tx`DELETE FROM role_master WHERE id = ${roleId}`
    return 'deleted'
  })
}

export async function replaceUserRoles(db: SQL, userId: string, assignedBy: string, roles: string[]): Promise<'saved' | 'account_missing' | 'role_missing'> {
  return db.begin(async (tx): Promise<'saved' | 'account_missing' | 'role_missing'> => {
    const [user] = await tx`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
    if (!user) return 'account_missing'
    for (const roleId of roles) {
      const [role] = await tx`SELECT id FROM role_master WHERE id = ${roleId} FOR KEY SHARE`
      if (!role) return 'role_missing'
    }
    await tx`DELETE FROM user_roles WHERE user_id = ${userId}`
    for (const roleId of roles) await tx`INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (${userId}, ${roleId}, ${assignedBy})`
    return 'saved'
  })
}

export async function setPasswordHash(db: SQL, userId: string, passwordHash: string): Promise<void> {
  await db`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`
}

// Creates the admin account, or promotes the account that already owns the email and replaces its password hash.
export async function upsertAdminUser(db: SQL, user: { id: string; email: string; passwordHash: string }): Promise<string> {
  const [row] = await db`INSERT INTO users (id, email, password_hash, is_admin) VALUES (${user.id}, ${user.email}, ${user.passwordHash}, true) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_admin = true RETURNING id`
  return row.id
}

export async function isAdminUser(db: SQL, userId: string): Promise<boolean> {
  const [row] = await db`SELECT is_admin AS "isAdmin" FROM users WHERE id = ${userId}`
  return row?.isAdmin === true
}
