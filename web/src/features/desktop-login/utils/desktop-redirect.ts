// The desktop app sends the custom-scheme address it registered. Only that exact address is accepted, so a crafted link cannot
// send a sign-in box to another place.
const desktopSignInRedirect = 'api-docs://auth/finish'

export function isDesktopSignInRedirect(value: string): boolean {
  return value === desktopSignInRedirect
}

export function desktopSignInLink(state: string, box: string): string {
  const link = new URL(desktopSignInRedirect)
  link.searchParams.set('state', state)
  link.searchParams.set('box', box)
  return link.toString()
}
