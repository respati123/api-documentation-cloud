import { SQL } from 'bun'
import { z } from 'zod'
import { AppError } from '@/lib/errors/app-error'
import { runMigrations } from '@/migrate'
import { createOidcClient, listOidcClients, rotateOidcClientSecret, setOidcClientDisabled } from '@/services/oidc-clients'
import { parseOidcClientArgs } from './oidc-client-args'

// Registers the apps that may sign in with the portal. Usage is in PLAN-sso-oidc.md, Task 1.8.
// A secret is printed once, when it is created or rotated. It is never stored in plain text and never written to a log.
const env = z.object({ DATABASE_URL: z.string().min(1) }).safeParse(process.env)
if (!env.success) {
  console.error('Set DATABASE_URL before running the OIDC client command.')
  process.exit(1)
}

const db = new SQL(env.data.DATABASE_URL)
try {
  const args = parseOidcClientArgs(process.argv.slice(2))
  await runMigrations(db, new URL('../../migrations/', import.meta.url), { info: () => undefined })

  if (args.command === 'create') {
    const created = await createOidcClient(db, { clientId: args.clientId, name: args.name, redirectUris: args.redirectUris, postLogoutRedirectUris: args.postLogoutRedirectUris })
    console.log(`Registered ${created.clientId}.`)
    console.log('Copy this secret now. It is not shown again.')
    console.log(`client_secret: ${created.secret}`)
  } else if (args.command === 'rotate-secret') {
    const secret = await rotateOidcClientSecret(db, args.clientId)
    console.log('Copy this secret now. It is not shown again.')
    console.log(`client_secret: ${secret}`)
  } else if (args.command === 'disable' || args.command === 'enable') {
    await setOidcClientDisabled(db, args.clientId, args.command === 'disable')
    console.log(`${args.clientId} is now ${args.command === 'disable' ? 'disabled' : 'enabled'}.`)
  } else {
    for (const client of await listOidcClients(db)) {
      console.log(`${client.clientId}\t${client.name}\t${client.disabled ? 'disabled' : 'enabled'}\t${client.redirectUris.join(' ')}`)
    }
  }
} catch (error) {
  // Print the error code only. Input values and secrets are never printed here.
  console.error(error instanceof AppError ? `The OIDC client command stopped: ${error.code}` : 'The OIDC client command failed.')
  process.exitCode = 1
} finally {
  await db.close()
}
