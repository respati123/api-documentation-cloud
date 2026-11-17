import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { isPasswordLengthValid } from '@/lib/password-policy'
import { isAdminUser, upsertAdminUser } from '@/repositories/users.repository'

// Creates or updates the single app admin. Safe to run again: the same email keeps one account and gets the new password.
export async function seedAdmin(db: SQL, input: { email: string; password: string }): Promise<string> {
  const email = input.email.trim().toLowerCase()
  if (!email.includes('@') || email.length > 254) throw new AppError('ADMIN_SEED_INVALID')
  if (!isPasswordLengthValid(input.password)) throw new AppError('PASSWORD_LENGTH_INVALID')
  const passwordHash = await Bun.password.hash(input.password, { algorithm: 'argon2id' })
  return upsertAdminUser(db, { id: randomUUID(), email, passwordHash })
}

export function isAdmin(db: SQL, userId: string): Promise<boolean> {
  return isAdminUser(db, userId)
}

export async function requireAdmin(db: SQL, userId: string): Promise<void> {
  if (!(await isAdminUser(db, userId))) throw new AppError('ADMIN_REQUIRED')
}
