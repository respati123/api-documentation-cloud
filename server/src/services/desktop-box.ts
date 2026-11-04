import { createCipheriv, createDecipheriv, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, type KeyObject, randomBytes } from 'node:crypto'
import { AppError } from '@/lib/errors/app-error'

// The sign-in box carries a session token to the desktop app. Only the desktop holds the private key, so the token is never readable
// from the link. Layout, base64url: version (1 byte) | server ephemeral public key (32) | iv (12) | tag (16) | ciphertext.
const version = 1
const spkiPrefix = Buffer.from('302a300506032b656e032100', 'hex')
const info = Buffer.from('api-docs desktop sign-in v1')

// Refuses a key that is not an X25519 public key, before any session is created for it.
export function checkDesktopKey(encoded: string): void {
  importPublicKey(encoded)
}

function importPublicKey(encoded: string): KeyObject {
  const raw = Buffer.from(encoded, 'base64url')
  if (raw.length !== 32) throw new AppError('DESKTOP_KEY_INVALID')
  return createPublicKey({ key: Buffer.concat([spkiPrefix, raw]), format: 'der', type: 'spki' })
}

function deriveKey(shared: Buffer, serverPublic: Buffer, clientPublic: Buffer): Buffer {
  return Buffer.from(hkdfSync('sha256', shared, Buffer.concat([serverPublic, clientPublic]), info, 32))
}

// Seals a session token so that only the holder of the matching private key can open it.
export function sealForDesktop(clientPublicKey: string, token: string): string {
  const clientKey = importPublicKey(clientPublicKey)
  const clientRaw = clientKey.export({ format: 'der', type: 'spki' }).subarray(12)
  const ephemeral = generateKeyPairSync('x25519')
  const serverRaw = ephemeral.publicKey.export({ format: 'der', type: 'spki' }).subarray(12)
  const key = deriveKey(diffieHellman({ privateKey: ephemeral.privateKey, publicKey: clientKey }), serverRaw, clientRaw)
  const header = Buffer.from([version])
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.concat([header, serverRaw]))
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return Buffer.concat([header, serverRaw, iv, cipher.getAuthTag(), ciphertext]).toString('base64url')
}

// The desktop side of the same format. The server uses it in tests, and the desktop app has its own copy.
export function openDesktopBox(privateKey: KeyObject, box: string): string {
  const data = Buffer.from(box, 'base64url')
  if (data[0] !== version) throw new Error('Unknown box version.')
  const serverRaw = data.subarray(1, 33)
  const iv = data.subarray(33, 45)
  const tag = data.subarray(45, 61)
  const ciphertext = data.subarray(61)
  const serverKey = createPublicKey({ key: Buffer.concat([spkiPrefix, serverRaw]), format: 'der', type: 'spki' })
  const clientPublic = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(12)
  const key = deriveKey(diffieHellman({ privateKey, publicKey: serverKey }), serverRaw, clientPublic)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(Buffer.concat([Buffer.from([version]), serverRaw]))
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
