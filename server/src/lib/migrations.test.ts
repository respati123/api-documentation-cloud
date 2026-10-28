import { describe, expect, test } from 'bun:test'
import { checksumOf, MigrationError, parseMigration, planMigrations, sortMigrations, splitStatements } from './migrations'

const sqlA = 'CREATE TABLE a (id TEXT);'
const sqlB = 'CREATE TABLE b (id TEXT);'

describe('parseMigration', () => {
  test('reads the version and name from the file name and checksums the SQL', () => {
    const file = parseMigration('0002_password_resets.sql', sqlB)

    expect(file).toEqual({ version: 2, name: 'password_resets', sql: sqlB, checksum: checksumOf(sqlB) })
  })

  test.each(['schema.sql', '2_init.sql', '0001-init.sql', '0001_Init.sql', '0001_init.txt'])('refuses the file name %s', (fileName) => {
    expect(() => parseMigration(fileName, sqlA)).toThrow(MigrationError)
  })

  test('the checksum changes when the SQL changes', () => {
    expect(checksumOf(sqlA)).not.toBe(checksumOf(sqlB))
  })
})

describe('sortMigrations', () => {
  test('orders files by version', () => {
    const sorted = sortMigrations([parseMigration('0002_b.sql', sqlB), parseMigration('0001_a.sql', sqlA)])

    expect(sorted.map((file) => file.version)).toEqual([1, 2])
  })

  test('refuses two files with the same version', () => {
    expect(() => sortMigrations([parseMigration('0001_a.sql', sqlA), parseMigration('0001_b.sql', sqlB)])).toThrow(MigrationError)
  })
})

describe('planMigrations', () => {
  const files = [parseMigration('0001_a.sql', sqlA), parseMigration('0002_b.sql', sqlB)]

  test('runs everything on a fresh database', () => {
    expect(planMigrations(files, []).map((file) => file.version)).toEqual([1, 2])
  })

  test('runs only the migrations after the applied ones', () => {
    const applied = [{ version: 1, checksum: checksumOf(sqlA) }]

    expect(planMigrations(files, applied).map((file) => file.version)).toEqual([2])
  })

  test('does nothing when everything is applied', () => {
    const applied = files.map((file) => ({ version: file.version, checksum: file.checksum }))

    expect(planMigrations(files, applied)).toEqual([])
  })

  test('refuses to run when an applied file changed', () => {
    const applied = [{ version: 1, checksum: checksumOf('CREATE TABLE changed (id TEXT);') }]

    expect(() => planMigrations(files, applied)).toThrow(MigrationError)
  })

  test('refuses to run when an applied version has no file', () => {
    const applied = [{ version: 9, checksum: 'x' }]

    expect(() => planMigrations(files, applied)).toThrow(MigrationError)
  })

  test('refuses a pending migration that is older than an applied one', () => {
    const applied = [{ version: 2, checksum: checksumOf(sqlB) }]

    expect(() => planMigrations(files, applied)).toThrow(MigrationError)
  })
})

describe('splitStatements', () => {
  test('splits on semicolons and drops empty parts', () => {
    expect(splitStatements('CREATE TABLE a (id TEXT);\n\n CREATE TABLE b (id TEXT);\n')).toEqual([
      'CREATE TABLE a (id TEXT)',
      'CREATE TABLE b (id TEXT)',
    ])
  })
})
