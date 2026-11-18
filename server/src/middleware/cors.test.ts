import { describe, expect, test } from 'bun:test'
import { corsHeaders, preflightResponse } from './cors'

const allowed = ['https://docs.example.com', 'http://localhost:5174']

describe('corsHeaders', () => {
  test('allows a listed origin and varies on Origin', () => {
    const headers = corsHeaders('https://docs.example.com', allowed)
    expect(headers.get('Access-Control-Allow-Origin')).toBe('https://docs.example.com')
    expect(headers.get('Vary')).toBe('Origin')
  })

  test('sends no allow-origin header for an unlisted origin', () => {
    expect(corsHeaders('https://evil.test', allowed).get('Access-Control-Allow-Origin')).toBeNull()
  })

  test('sends no CORS header when there is no Origin (desktop, curl)', () => {
    expect(corsHeaders(null, allowed).get('Access-Control-Allow-Origin')).toBeNull()
  })

  test('never uses a wildcard', () => {
    expect(corsHeaders('https://evil.test', allowed).get('Access-Control-Allow-Origin')).not.toBe('*')
  })
})

describe('allowed methods', () => {
  test('include PUT, which sets a column limit, next to the others', () => {
    const methods = (preflightResponse('http://localhost:5174', allowed).headers.get('Access-Control-Allow-Methods') ?? '').split(', ')
    expect(methods).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
  })
})

describe('preflightResponse', () => {
  test('answers 204 for a listed origin', () => {
    const response = preflightResponse('http://localhost:5174', allowed)
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
  })

  test('answers 403 for an unlisted origin', () => {
    expect(preflightResponse('https://evil.test', allowed).status).toBe(403)
  })
})
