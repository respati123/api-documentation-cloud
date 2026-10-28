import { describe, expect, test } from 'vitest'
import enAuth from './locales/en/auth.json'
import enCommon from './locales/en/common.json'
import idAuth from './locales/id/auth.json'
import idCommon from './locales/id/common.json'

type Tree = { [key: string]: string | Tree }

function flatKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flatKeys(value, `${prefix}${key}.`),
  )
}

describe('locale files', () => {
  test.each([
    ['auth', enAuth, idAuth],
    ['common', enCommon, idCommon],
  ])('%s has the same keys in en and id', (_name, en, id) => {
    expect(flatKeys(id).sort()).toEqual(flatKeys(en).sort())
  })

  test('no value is empty', () => {
    const empty = [...flatKeys(enAuth), ...flatKeys(idAuth), ...flatKeys(enCommon), ...flatKeys(idCommon)]
    expect(empty.length).toBeGreaterThan(0)
  })
})
