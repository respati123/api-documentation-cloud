import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from './locales/en/portal.json'
import id from './locales/id/portal.json'

type Tree = { [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === 'string' ? [[`${prefix}${key}`, value]] : Object.entries(flatten(value, `${prefix}${key}.`)),
    ),
  )
}

function sourceFiles(path: string): string[] {
  return readdirSync(path).flatMap(name => {
    const full = join(path, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
  })
}

describe('portal locale', () => {
  const english = flatten(en)
  const indonesian = flatten(id)

  it('has the same keys in English and Indonesian', () => {
    expect(Object.keys(indonesian).sort()).toEqual(Object.keys(english).sort())
  })

  it('has no empty values', () => {
    for (const [key, value] of [...Object.entries(english), ...Object.entries(indonesian)]) {
      expect(value.trim(), key).not.toBe('')
    }
  })

  it('defines every key the portal code reads with t()', () => {
    const used = new Set<string>()
    for (const file of sourceFiles(resolve('src/features'))) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(/\bt\(\s*'([A-Za-z][\w.]*)'/g)) used.add(match[1])
    }
    const missing = [...used].filter(key => !(key in english))
    expect(missing).toEqual([])
  })

  it('keeps interpolation placeholders identical in both languages', () => {
    for (const key of Object.keys(english)) {
      const placeholders = (value: string) => [...value.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]).sort()
      expect(placeholders(indonesian[key]), key).toEqual(placeholders(english[key]))
    }
  })
})
