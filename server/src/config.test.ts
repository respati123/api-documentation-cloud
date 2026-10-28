import { describe, expect, test } from 'bun:test'
import { loadConfig } from './config'

const required = {
  DATABASE_URL: 'postgres://apidocs:secret-pass@db:5432/apidocs',
  PUBLIC_WEB_URL: 'https://docs.example.com',
}

describe('loadConfig', () => {
  test('names the missing variable without printing any value', () => {
    expect(() => loadConfig({ PUBLIC_WEB_URL: required.PUBLIC_WEB_URL })).toThrow('DATABASE_URL')
    try {
      loadConfig({ PUBLIC_WEB_URL: required.PUBLIC_WEB_URL })
    } catch (error) {
      expect(String(error)).not.toContain('secret-pass')
    }
  })

  test('applies defaults', () => {
    const config = loadConfig(required)
    expect(config.port).toBe(3001)
    expect(config.logLevel).toBe('info')
    expect(config.dbPoolMax).toBe(10)
    expect(config.dbStatementTimeoutMs).toBe(5000)
    expect(config.corsOrigins).toEqual([])
  })

  test('splits CORS_ORIGINS and trims each entry', () => {
    const config = loadConfig({ ...required, CORS_ORIGINS: ' https://a.test , http://localhost:5174 ' })
    expect(config.corsOrigins).toEqual(['https://a.test', 'http://localhost:5174'])
  })

  test('rejects an unknown log level', () => {
    expect(() => loadConfig({ ...required, LOG_LEVEL: 'verbose' })).toThrow('LOG_LEVEL')
  })
})
