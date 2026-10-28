import { describe, expect, test } from 'bun:test'
import { errorDefinitions, type ErrorCode } from './codes'
import { messages } from './messages'

const codes = Object.keys(errorDefinitions) as ErrorCode[]

describe('error messages', () => {
  test.each(codes)('%s has a message in English and Indonesian', (code) => {
    expect(messages.en[code]).toBeTruthy()
    expect(messages.id[code]).toBeTruthy()
  })

  test('both languages cover exactly the same codes', () => {
    expect(Object.keys(messages.id).sort()).toEqual(Object.keys(messages.en).sort())
  })

  test('a message with a parameter renders the value', () => {
    const invite = messages.en.INVITE_EMAIL_MISMATCH
    expect(typeof invite).toBe('function')
    expect(typeof invite === 'function' && invite({ email: 'a@b.test' })).toContain('a@b.test')
  })
})
