// The sign-in step for other apps. Another app sends the user here with the OIDC query values.
export function isOidcAuthorizeRoute(pathname: string): boolean {
  return pathname === '/oidc/authorize'
}

// The sign-out step for other apps. It works even when the portal session has already ended.
export function isOidcLogoutRoute(pathname: string): boolean {
  return pathname === '/oidc/logout'
}
