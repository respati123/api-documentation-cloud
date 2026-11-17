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

describe('loadConfig OIDC settings', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nMIGHAgEA\n-----END PRIVATE KEY-----\n'
  const pemB64 = Buffer.from(pem).toString('base64')

  test('OIDC is off when neither key variable is set', () => {
    expect(loadConfig(required).oidc).toBeNull()
  })

  test('refuses a signing key without its key id, and names the missing variable', () => {
    expect(() => loadConfig({ ...required, OIDC_SIGNING_KEY_B64: pemB64 })).toThrow('OIDC_SIGNING_KEY_ID')
  })

  test('refuses a key id without its signing key, and names the missing variable', () => {
    expect(() => loadConfig({ ...required, OIDC_SIGNING_KEY_ID: '2026-11' })).toThrow('OIDC_SIGNING_KEY_B64')
  })

  test('builds the issuer from PUBLIC_WEB_URL and decodes the key', () => {
    const config = loadConfig({ ...required, OIDC_SIGNING_KEY_B64: pemB64, OIDC_SIGNING_KEY_ID: '2026-11' })
    expect(config.oidc).toEqual({ signingKeyPem: pem, keyId: '2026-11', issuer: 'https://docs.example.com/api/oidc' })
  })

  test('drops a trailing slash from PUBLIC_WEB_URL in the issuer', () => {
    const config = loadConfig({ ...required, PUBLIC_WEB_URL: 'https://docs.example.com/', OIDC_SIGNING_KEY_B64: pemB64, OIDC_SIGNING_KEY_ID: '2026-11' })
    expect(config.oidc?.issuer).toBe('https://docs.example.com/api/oidc')
  })
})

describe('loadConfig app addresses', () => {
  test('apps are off when their address is not set', () => {
    expect(loadConfig(required).apps).toEqual({ dbdesign: null, stitchkit: null })
  })

  test('reads each app address and drops a trailing slash', () => {
    const config = loadConfig({ ...required, DBDESIGN_URL: 'https://dbdesign.example.com/', STITCHKIT_URL: 'https://stitchkit.example.com' })
    expect(config.apps).toEqual({ dbdesign: 'https://dbdesign.example.com', stitchkit: 'https://stitchkit.example.com' })
  })

  test('refuses an address that is not a URL', () => {
    expect(() => loadConfig({ ...required, DBDESIGN_URL: 'not a url' })).toThrow('DBDESIGN_URL')
  })
})
