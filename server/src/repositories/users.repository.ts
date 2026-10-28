import type { SQL } from 'bun'
import type { AuthUser } from '@/models/workspace'

export interface UserCredentials extends AuthUser {
  passwordHash: string
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

export async function findUserById(db: SQL, id: string): Promise<AuthUser | undefined> {
  const [row] = await db`SELECT id, email FROM users WHERE id = ${id}`
  return row
}

export async function setPasswordHash(db: SQL, userId: string, passwordHash: string): Promise<void> {
  await db`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`
}
