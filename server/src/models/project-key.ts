const KEY_PATTERN = /^[A-Z]{2,10}$/

export function isProjectKey(value: unknown): value is string {
  return typeof value === 'string' && KEY_PATTERN.test(value)
}

// The key of a new project: the initials of its words (up to six), or the first four letters of a one-word name,
// or PRJ when the name has fewer than two plain letters. Migration 0023 uses the same rules in SQL.
// When the key is taken in the workspace, a two-letter suffix is added: AA, AB, ... AZ, BA, ...
export function makeProjectKey(name: string, taken: readonly string[]): string {
  const plain = name.replace(/[^A-Za-z ]/g, '').toUpperCase()
  const initials = plain
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
  const letters = plain.replace(/ /g, '')
  const base = initials.length >= 2 ? initials.slice(0, 6) : letters.length >= 2 ? letters.slice(0, 4) : 'PRJ'
  if (!taken.includes(base)) return base
  for (let index = 0; index < 26 * 26; index += 1) {
    const key = base + String.fromCharCode(65 + (Math.floor(index / 26) % 26)) + String.fromCharCode(65 + (index % 26))
    if (!taken.includes(key)) return key
  }
  throw new Error(`No free project key for ${base}`)
}
