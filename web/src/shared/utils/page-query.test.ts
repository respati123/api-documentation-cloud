import { describe, expect, test } from 'vitest'
import { PAGE_SIZE, pageQuery } from './page-query'

describe('pageQuery', () => {
  test('asks for the first page with the standard size', () => {
    expect(pageQuery(null)).toBe(`?limit=${PAGE_SIZE}`)
  })

  test('adds the cursor for the next page and escapes it', () => {
    expect(pageQuery('a+b/c=')).toBe(`?limit=${PAGE_SIZE}&cursor=a%2Bb%2Fc%3D`)
  })
})
