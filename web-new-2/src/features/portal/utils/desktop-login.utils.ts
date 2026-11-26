// The desktop app sends the custom-scheme address it registered. Only that exact address is accepted.
const desktopSignInRedirect = 'api-docs://auth/finish'

export interface DesktopLoginRequest {
  state: string
  publicKey: string
  valid: boolean
}

export function readDesktopLoginRequest(search: string): DesktopLoginRequest | null {
  const params = new URLSearchParams(search)
  const state = params.get('desktopLoginState')
  if (state === null) return null
  const publicKey = params.get('pk') ?? ''
  return {
    state,
    publicKey,
    valid: state !== '' && publicKey !== '' && params.get('redirect') === desktopSignInRedirect,
  }
}

export function desktopSignInLink(state: string, box: string): string {
  const link = new URL(desktopSignInRedirect)
  link.searchParams.set('state', state)
  link.searchParams.set('box', box)
  return link.toString()
}
