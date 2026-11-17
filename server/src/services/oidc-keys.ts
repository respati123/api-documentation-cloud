import { createPublicKey, randomUUID } from 'node:crypto'
import { exportJWK, importJWK, importPKCS8, jwtVerify, SignJWT, type CryptoKey, type JWK } from 'jose'

export interface OidcKeyOptions {
  signingKeyPem: string
  keyId: string
  issuer: string
}

export interface OidcUser {
  id: string
  email: string
  isAdmin: boolean
}

const ID_TOKEN_LIFETIME = '5m'
const ACCESS_TOKEN_LIFETIME = '5m'
const SERVICE_TOKEN_LIFETIME = '60s'

// Signs and checks the OIDC tokens. The private key is read once, from the environment, and is never returned.
export function createOidcKeys(options: OidcKeyOptions) {
  let loaded: { signing: CryptoKey; publicJwk: JWK } | null = null
  const userInfoAudience = `${options.issuer}/userinfo`

  async function load() {
    if (!loaded) {
      const signing = await importPKCS8(options.signingKeyPem, 'ES256')
      const jwk = await exportJWK(createPublicKey(options.signingKeyPem))
      loaded = { signing, publicJwk: { ...jwk, kid: options.keyId, alg: 'ES256', use: 'sig' } }
    }
    return loaded
  }

  return {
    async publicJwks(): Promise<{ keys: JWK[] }> {
      const { publicJwk } = await load()
      return { keys: [publicJwk] }
    },

    async signIdToken(input: { user: OidcUser; clientId: string; nonce: string }): Promise<string> {
      const { signing } = await load()
      return new SignJWT({ nonce: input.nonce, email: input.user.email, name: input.user.email, is_admin: input.user.isAdmin })
        .setProtectedHeader({ alg: 'ES256', kid: options.keyId, typ: 'JWT' })
        .setIssuer(options.issuer)
        .setSubject(input.user.id)
        .setAudience(input.clientId)
        .setIssuedAt()
        .setExpirationTime(ID_TOKEN_LIFETIME)
        .sign(signing)
    },

    async signAccessToken(input: { user: OidcUser; clientId: string; scope: string }): Promise<string> {
      const { signing } = await load()
      return new SignJWT({ client_id: input.clientId, scope: input.scope })
        .setProtectedHeader({ alg: 'ES256', kid: options.keyId, typ: 'JWT' })
        .setIssuer(options.issuer)
        .setSubject(input.user.id)
        .setAudience(userInfoAudience)
        .setIssuedAt()
        .setExpirationTime(ACCESS_TOKEN_LIFETIME)
        .setJti(randomUUID())
        .sign(signing)
    },

    // A short token the portal sends when it calls DBDesign or Stitchkit for a member. The app checks the audience
    // and token_use, so an ID token for the same client is never accepted in its place.
    async signServiceToken(input: { user: OidcUser; audience: string }): Promise<string> {
      const { signing } = await load()
      return new SignJWT({ token_use: 'service', email: input.user.email, is_admin: input.user.isAdmin })
        .setProtectedHeader({ alg: 'ES256', kid: options.keyId, typ: 'JWT' })
        .setIssuer(options.issuer)
        .setSubject(input.user.id)
        .setAudience(input.audience)
        .setIssuedAt()
        .setExpirationTime(SERVICE_TOKEN_LIFETIME)
        .setJti(randomUUID())
        .sign(signing)
    },

    // Accepts only tokens made for the user info endpoint. Throws when the token is not valid.
    async verifyAccessToken(token: string): Promise<{ sub: string; client_id: string; scope: string }> {
      const { publicJwk } = await load()
      const key = await importJWK(publicJwk, 'ES256')
      const { payload } = await jwtVerify(token, key, { issuer: options.issuer, audience: userInfoAudience, algorithms: ['ES256'] })
      return payload as { sub: string; client_id: string; scope: string }
    },
  }
}

export type OidcKeys = ReturnType<typeof createOidcKeys>
