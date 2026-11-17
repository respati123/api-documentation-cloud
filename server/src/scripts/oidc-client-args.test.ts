import { describe, expect, test } from 'bun:test'
import { AppError } from '@/lib/errors/app-error'
import { parseOidcClientArgs } from './oidc-client-args'

function codeOf(run: () => unknown): string | undefined {
  try {
    run()
  } catch (error) {
    return error instanceof AppError ? error.code : 'unexpected'
  }
  return undefined
}

describe('parseOidcClientArgs', () => {
  test('reads create with a repeated redirect URI and logout URI', () => {
    expect(
      parseOidcClientArgs([
        'create', '--client-id', 'dbdesign', '--name', 'DBDesign',
        '--redirect-uri', 'https://a.test/cb', '--redirect-uri', 'http://localhost:5173/cb',
        '--post-logout-uri', 'https://a.test/',
      ]),
    ).toEqual({
      command: 'create',
      clientId: 'dbdesign',
      name: 'DBDesign',
      redirectUris: ['https://a.test/cb', 'http://localhost:5173/cb'],
      postLogoutRedirectUris: ['https://a.test/'],
    })
  })

  test('reads the simple commands with only a client id', () => {
    expect(parseOidcClientArgs(['rotate-secret', '--client-id', 'dbdesign'])).toMatchObject({ command: 'rotate-secret', clientId: 'dbdesign' })
    expect(parseOidcClientArgs(['list'])).toMatchObject({ command: 'list' })
  })

  test('refuses an unknown command and a flag with no value', () => {
    expect(codeOf(() => parseOidcClientArgs(['delete', '--client-id', 'x']))).toBe('OIDC_REQUEST_INVALID')
    expect(codeOf(() => parseOidcClientArgs(['create', '--client-id']))).toBe('OIDC_REQUEST_INVALID')
  })
})
