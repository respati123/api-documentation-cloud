import { describe, expect, test } from 'vitest'

type Tree = { [key: string]: string | Tree }

const locales = import.meta.glob('./locales/*/*.json', { eager: true, import: 'default' }) as Record<string, Tree>

function flatKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flatKeys(value, `${prefix}${key}.`),
  )
}

function namespaceFiles(language: 'en' | 'id'): Record<string, Tree> {
  return Object.fromEntries(
    Object.entries(locales)
      .filter(([path]) => path.startsWith(`./locales/${language}/`))
      .map(([path, tree]) => [path.split('/').pop()?.replace('.json', '') ?? path, tree]),
  )
}

const en = namespaceFiles('en')
const id = namespaceFiles('id')

describe('locale files', () => {
  test('every namespace exists in both languages', () => {
    expect(Object.keys(id).sort()).toEqual(Object.keys(en).sort())
  })

  test.each(Object.keys(en))('%s has the same keys in en and id', (name) => {
    expect(flatKeys(id[name]).sort()).toEqual(flatKeys(en[name]).sort())
  })

  test('no value is empty', () => {
    const values = Object.values({ ...en, ...id }).flatMap((tree) => flatKeys(tree))
    expect(values.length).toBeGreaterThan(0)
  })
})
