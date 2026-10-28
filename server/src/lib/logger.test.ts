import { describe, expect, test } from 'bun:test'
import { createLogger, serializeError } from './logger'

function capture() {
  const lines: Record<string, unknown>[] = []
  const sink = (line: string) => lines.push(JSON.parse(line))
  return { lines, sink }
}

describe('logger', () => {
  test('writes one JSON line with base fields', () => {
    const { lines, sink } = capture()
    createLogger({ level: 'info', service: 'api', version: '0.1.6', sink }).info('server started')

    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ level: 'info', msg: 'server started', service: 'api', version: '0.1.6' })
    expect(typeof lines[0].time).toBe('string')
  })

  test('drops lines below the configured level', () => {
    const { lines, sink } = capture()
    createLogger({ level: 'warn', service: 'api', version: 'dev', sink }).info('quiet')
    expect(lines).toHaveLength(0)
  })

  test('redacts secret fields at any depth', () => {
    const { lines, sink } = capture()
    createLogger({ level: 'info', service: 'api', version: 'dev', sink }).info('login', {
      email: 'a@b.test',
      password: 'correct-horse-1',
      nested: { token: 'abc', authorization: 'Bearer abc' },
    })

    expect(JSON.stringify(lines[0])).not.toContain('correct-horse-1')
    expect(JSON.stringify(lines[0])).not.toContain('Bearer abc')
    expect(lines[0]).toMatchObject({ email: 'a@b.test', nested: { token: '[REDACTED]', authorization: '[REDACTED]' } })
  })
})

describe('serializeError', () => {
  test('keeps name, message, code, and stack', () => {
    const error = Object.assign(new Error('deadlock detected'), { code: '40P01' })
    expect(serializeError(error)).toMatchObject({ name: 'Error', message: 'deadlock detected', code: '40P01' })
    expect(typeof serializeError(error).stack).toBe('string')
  })

  test('follows the cause chain', () => {
    const error = new Error('outer', { cause: new Error('inner') })
    expect(serializeError(error).cause).toMatchObject({ message: 'inner' })
  })

  test('stops the cause chain at depth 5', () => {
    let error = new Error('level-0')
    for (let i = 1; i < 10; i++) error = new Error(`level-${i}`, { cause: error })
    let depth = 0
    let current: ReturnType<typeof serializeError> | undefined = serializeError(error)
    while (current?.cause) {
      depth++
      current = current.cause
    }
    expect(depth).toBe(5)
  })
})
