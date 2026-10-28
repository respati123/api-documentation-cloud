import { describe, expect, test } from 'vitest'

const RAW_ELEMENT = /<(button|input|select|textarea|label|table|hr|a)[\s/>]/g
const JSX_TEXT = /(?<![=<-])>[ \t]*[A-Za-z][^<>{}\n]*</g
const LITERAL_ATTRIBUTE = /\b(aria-label|placeholder|title|alt)=["'][^"']*[A-Za-z]/g
const LITERAL_TRANSLATION_KEY = /\bt\(\s*['"`]/g

const sources = import.meta.glob('../{features,app,shared}/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

function isSource(path: string): boolean {
  return !/\.test\.tsx?$/.test(path)
}

function featureSources(folder: 'views' | 'pages' | 'viewmodels'): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sources).filter(([path]) => isSource(path) && path.startsWith('../features/') && path.split('/').includes(folder)),
  )
}

// Composition and shared presentational components are views too. Generated shadcn files in ui/ are not.
function presentationSources(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sources).filter(
      ([path]) => isSource(path) && (path.startsWith('../app/') || (path.startsWith('../shared/components/') && !path.includes('/ui/'))),
    ),
  )
}

function violations(files: Record<string, string>, pattern: RegExp): string[] {
  return Object.entries(files).flatMap(([path, source]) =>
    [...source.matchAll(pattern)].map((match) => {
      const line = source.slice(0, match.index).split('\n').length
      return `${path}:${line}: ${match[0].replace(/\s+/g, ' ').trim()}`
    }),
  )
}

const viewFiles = { ...featureSources('views'), ...featureSources('pages'), ...presentationSources() }
const translatedFiles = { ...viewFiles, ...featureSources('viewmodels') }

describe('shadcn-only markup in views', () => {
  test('the rules scan real view and page files', () => {
    expect(Object.keys(viewFiles).length).toBeGreaterThan(0)
  })

  test('views use shadcn components instead of raw interactive elements', () => {
    expect(violations(viewFiles, RAW_ELEMENT)).toEqual([])
  })
})

describe('no hard-coded text in views', () => {
  test('views render no literal text nodes', () => {
    expect(violations(viewFiles, JSX_TEXT)).toEqual([])
  })

  test('views pass no literal attribute text', () => {
    expect(violations(viewFiles, LITERAL_ATTRIBUTE)).toEqual([])
  })
})

describe('translation keys come from constants', () => {
  test('views and viewmodels call t() with a constant, never a literal or template', () => {
    expect(violations(translatedFiles, LITERAL_TRANSLATION_KEY)).toEqual([])
  })
})
