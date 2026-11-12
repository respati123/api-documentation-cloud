import { SQL } from 'bun'
import { z } from 'zod'
import { AppError } from '@/lib/errors/app-error'
import { runMigrations } from '@/migrate'
import { seedAdmin } from '@/services/admin'

// Creates or updates the app admin from ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD. Run it once per environment, and again to rotate the password.
const env = z
  .object({ DATABASE_URL: z.string().min(1), ADMIN_SEED_EMAIL: z.string().min(1), ADMIN_SEED_PASSWORD: z.string().min(1) })
  .safeParse(process.env)

if (!env.success) {
  console.error('Set DATABASE_URL, ADMIN_SEED_EMAIL, and ADMIN_SEED_PASSWORD before running the admin seeder.')
  process.exit(1)
}

const db = new SQL(env.data.DATABASE_URL)
try {
  await runMigrations(db, new URL('../../migrations/', import.meta.url), { info: () => undefined })
  await seedAdmin(db, { email: env.data.ADMIN_SEED_EMAIL, password: env.data.ADMIN_SEED_PASSWORD })
  console.log('The admin account is ready.')
} catch (error) {
  // The password never reaches the output. An AppError prints only its code.
  console.error(error instanceof AppError ? `The admin seeder stopped: ${error.code}` : 'The admin seeder failed.')
  process.exitCode = 1
} finally {
  await db.close()
}
