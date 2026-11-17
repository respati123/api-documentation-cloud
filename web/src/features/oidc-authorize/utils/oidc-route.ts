// The sign-in step for other apps. Another app sends the user here with the OIDC query values.
export function isOidcAuthorizeRoute(pathname: string): boolean {
  return pathname === '/oidc/authorize'
}
