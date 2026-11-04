import { describe, expect, test } from 'bun:test'
import { generateKeyPairSync } from 'node:crypto'
import { openDesktopBox, sealForDesktop } from '@/services/desktop-box'

function desktopKeys() {
  const pair = generateKeyPairSync('x25519')
  const raw = pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64url')
  return { privateKey: pair.privateKey, publicKey: raw }
}

describe('desktop sign-in box', () => {
  test('only the desktop that made the public key can open the box', () => {
    const desktop = desktopKeys()
    const box = sealForDesktop(desktop.publicKey, 'session-token-1')
    expect(openDesktopBox(desktop.privateKey, box)).toBe('session-token-1')
  })

  test('a different key cannot open the box', () => {
    const desktop = desktopKeys()
    const other = desktopKeys()
    const box = sealForDesktop(desktop.publicKey, 'session-token-1')
    expect(() => openDesktopBox(other.privateKey, box)).toThrow()
  })

  test('each box is different, even for the same token and key', () => {
    const desktop = desktopKeys()
    expect(sealForDesktop(desktop.publicKey, 'same')).not.toBe(sealForDesktop(desktop.publicKey, 'same'))
  })

  test('a public key that is not 32 bytes is refused', () => {
    expect(() => sealForDesktop(Buffer.alloc(16).toString('base64url'), 'token')).toThrow()
    expect(() => sealForDesktop('not a key', 'token')).toThrow()
  })

  test('a changed box is refused', () => {
    const desktop = desktopKeys()
    const box = sealForDesktop(desktop.publicKey, 'session-token-1')
    const tampered = box.slice(0, -2) + (box.endsWith('AA') ? 'BB' : 'AA')
    expect(() => openDesktopBox(desktop.privateKey, tampered)).toThrow()
  })
})
