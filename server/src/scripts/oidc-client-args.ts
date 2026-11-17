import { AppError } from '@/lib/errors/app-error'

export interface OidcClientArgs {
  command: 'create' | 'list' | 'rotate-secret' | 'disable' | 'enable'
  clientId: string
  name: string
  redirectUris: string[]
  postLogoutRedirectUris: string[]
}

const COMMANDS = ['create', 'list', 'rotate-secret', 'disable', 'enable'] as const

// Reads: <command> [--client-id x] [--name x] [--redirect-uri x]... [--post-logout-uri x]...
export function parseOidcClientArgs(argv: string[]): OidcClientArgs {
  const [command, ...rest] = argv
  if (!command || !(COMMANDS as readonly string[]).includes(command)) throw new AppError('OIDC_REQUEST_INVALID')
  const parsed: OidcClientArgs = { command: command as OidcClientArgs['command'], clientId: '', name: '', redirectUris: [], postLogoutRedirectUris: [] }
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index]
    const value = rest[index + 1]
    if (!flag?.startsWith('--') || value === undefined || value.startsWith('--')) throw new AppError('OIDC_REQUEST_INVALID')
    if (flag === '--client-id') parsed.clientId = value
    else if (flag === '--name') parsed.name = value
    else if (flag === '--redirect-uri') parsed.redirectUris.push(value)
    else if (flag === '--post-logout-uri') parsed.postLogoutRedirectUris.push(value)
    else throw new AppError('OIDC_REQUEST_INVALID')
  }
  return parsed
}
