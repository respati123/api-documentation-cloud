export const supportedLocales = ['en', 'id'] as const
export type Locale = (typeof supportedLocales)[number]

const defaultLocale: Locale = 'en'
const languageTag = /^[a-z]{1,8}(-[a-z0-9]{1,8})*$/

interface RankedTag {
  language: string
  quality: number
}

export function negotiateLocale(header: string | null): Locale {
  if (!header) return defaultLocale
  const ranked = header
    .split(',')
    .map(parseEntry)
    .filter((entry): entry is RankedTag => entry !== null)
    .sort((a, b) => b.quality - a.quality)
  const match = ranked.find((entry) => isSupported(entry.language))
  return match && isSupported(match.language) ? match.language : defaultLocale
}

function parseEntry(raw: string): RankedTag | null {
  const [tagPart, ...parameters] = raw.trim().toLowerCase().split(';')
  const tag = tagPart.trim()
  if (!languageTag.test(tag)) return null
  const qualityParameter = parameters.map((part) => part.trim()).find((part) => part.startsWith('q='))
  const quality = qualityParameter ? Number(qualityParameter.slice(2)) : 1
  return { language: tag.split('-')[0], quality: Number.isFinite(quality) ? quality : 0 }
}

function isSupported(language: string): language is Locale {
  return (supportedLocales as readonly string[]).includes(language)
}
