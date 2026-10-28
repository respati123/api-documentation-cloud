import { SQL } from 'bun'
import { loadConfig } from '@/config'
import { createApp } from '@/app'
import { createAppContext } from '@/context'
import { createLogger } from '@/lib/logger'
import { runMigrations } from '@/migrate'

// Bootstrap only: read the config, apply migrations, then start the server.
const config = loadConfig()
const logger = createLogger({ level: config.logLevel, service: 'api', version: config.appVersion })
const db = new SQL(config.databaseUrl)

const applied = await runMigrations(db, new URL('../migrations/', import.meta.url), logger)
if (applied > 0) logger.info('migrations applied', { count: applied })

const app = createApp(createAppContext({ db, config, logger }))
Bun.serve({ port: config.port, websocket: app.websocket, fetch: app.fetch })
logger.info('API server listening', { port: config.port, corsOrigins: config.corsOrigins.length })
