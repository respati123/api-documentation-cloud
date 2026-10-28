// The desktop app opens the portal with ?desktopLoginState=...&redirect=... .
export function hasDesktopLoginRequest(search: string): boolean {
  return new URLSearchParams(search).has('desktopLoginState')
}
