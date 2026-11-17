import type { SQL } from 'bun'
import type { AppConfig } from '@/config'
import type { Logger } from '@/lib/logger'
import { RateLimiter } from '@/middleware/rate-limit'
import { createOidcKeys, type OidcKeys } from '@/services/oidc-keys'
import { createAppsClient, type AppsClient } from '@/services/apps-client'
import type { SyncSocketData, SyncSocketTicket } from '@/models/workspace'

// Everything a request handler needs. One context is built at startup and shared by every request.
export interface AppContext {
  db: SQL
  config: AppConfig
  logger: Logger
  limiter: RateLimiter
  syncSocketTickets: Map<string, SyncSocketTicket>
  syncSockets: Set<Bun.ServerWebSocket<SyncSocketData>>
  desktopLoginCodes: Map<string, { userId: string; expiresAt: number }>
  oidcKeys: OidcKeys | null
  apps: AppsClient
}

export function createAppContext(parts: Pick<AppContext, 'db' | 'config' | 'logger'>): AppContext {
  const oidcKeys = parts.config.oidc ? createOidcKeys(parts.config.oidc) : null
  return {
    ...parts,
    limiter: new RateLimiter(),
    syncSocketTickets: new Map(),
    syncSockets: new Set(),
    desktopLoginCodes: new Map(),
    oidcKeys,
    apps: createAppsClient({ apps: parts.config.apps, keys: oidcKeys }),
  }
}
