import { z } from 'zod'

const logLevels = ['debug', 'info', 'warn', 'error'] as const

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PUBLIC_WEB_URL: z.url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
  LOG_LEVEL: z.enum(logLevels).default('info'),
  APP_VERSION: z.string().default('dev'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).default(5000),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('API Documentation <no-reply@example.test>'),
  OIDC_SIGNING_KEY_B64: z.string().optional(),
  OIDC_SIGNING_KEY_ID: z.string().optional(),
  DBDESIGN_URL: z.url().optional(),
  STITCHKIT_URL: z.url().optional(),
})

export interface AppConfig {
  databaseUrl: string
  publicWebUrl: string
  port: number
  corsOrigins: string[]
  logLevel: (typeof logLevels)[number]
  appVersion: string
  dbPoolMax: number
  dbStatementTimeoutMs: number
  smtp: { host?: string; port: number; secure: boolean; user?: string; password?: string; from: string }
  oidc: OidcConfig | null
  // Where the portal reaches DBDesign and Stitchkit. An app without an address has no integration.
  apps: { dbdesign: string | null; stitchkit: string | null }
}

export interface OidcConfig {
  signingKeyPem: string
  keyId: string
  issuer: string
}

export class ConfigError extends Error {
  constructor(invalidKeys: string[]) {
    super(`Invalid configuration: ${invalidKeys.join(', ')}. Check the values in .env.`)
    this.name = 'ConfigError'
  }
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) throw new ConfigError([...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))])
  const values = parsed.data
  const oidc = readOidc(values)
  return {
    databaseUrl: values.DATABASE_URL,
    publicWebUrl: values.PUBLIC_WEB_URL,
    port: values.PORT,
    corsOrigins: values.CORS_ORIGINS,
    logLevel: values.LOG_LEVEL,
    appVersion: values.APP_VERSION,
    dbPoolMax: values.DB_POOL_MAX,
    dbStatementTimeoutMs: values.DB_STATEMENT_TIMEOUT_MS,
    smtp: {
      host: values.SMTP_HOST,
      port: values.SMTP_PORT,
      secure: values.SMTP_SECURE === 'true',
      user: values.SMTP_USER,
      password: values.SMTP_PASSWORD,
      from: values.SMTP_FROM,
    },
    oidc,
    apps: {
      dbdesign: values.DBDESIGN_URL ? values.DBDESIGN_URL.replace(/\/+$/, '') : null,
      stitchkit: values.STITCHKIT_URL ? values.STITCHKIT_URL.replace(/\/+$/, '') : null,
    },
  }
}

// The OIDC key is optional. It is either fully set (key and key id) or not set at all.
function readOidc(values: { PUBLIC_WEB_URL: string; OIDC_SIGNING_KEY_B64?: string; OIDC_SIGNING_KEY_ID?: string }): OidcConfig | null {
  const hasKey = Boolean(values.OIDC_SIGNING_KEY_B64)
  const hasKeyId = Boolean(values.OIDC_SIGNING_KEY_ID)
  if (!hasKey && !hasKeyId) return null
  if (!hasKey) throw new ConfigError(['OIDC_SIGNING_KEY_B64'])
  if (!hasKeyId) throw new ConfigError(['OIDC_SIGNING_KEY_ID'])
  return {
    signingKeyPem: Buffer.from(values.OIDC_SIGNING_KEY_B64!, 'base64').toString('utf8'),
    keyId: values.OIDC_SIGNING_KEY_ID!,
    issuer: `${values.PUBLIC_WEB_URL.replace(/\/+$/, '')}/api/oidc`,
  }
}
