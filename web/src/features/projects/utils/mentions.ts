export interface MentionMember {
  id: string
  email: string
}

export const handleOf = (member: MentionMember) => member.email.split('@')[0]

// The "@query" the caret sits right after, if any. A mention starts at the beginning or after whitespace.
export function activeMention(text: string, caret: number): { query: string; start: number } | null {
  const match = /(^|\s)@([\w.-]*)$/.exec(text.slice(0, caret))
  if (!match) return null
  return { query: match[2], start: caret - match[2].length - 1 }
}

export function insertMention(text: string, start: number, caret: number, handle: string): { text: string; caret: number } {
  const before = `${text.slice(0, start)}@${handle} `
  return { text: before + text.slice(caret).replace(/^\s+/, ''), caret: before.length }
}

export function mentionSuggestions(members: MentionMember[], query: string, limit = 6): MentionMember[] {
  const needle = query.toLowerCase()
  return members.filter((member) => handleOf(member).toLowerCase().startsWith(needle)).slice(0, limit)
}

// Members whose "@handle" still appears in the text when it is sent.
export function mentionedIds(text: string, members: MentionMember[]): string[] {
  return members
    .filter((member) => new RegExp(`(^|\\s)@${escapeRegExp(handleOf(member))}(?![\\w.-])`).test(text))
    .map((member) => member.id)
}

export type BodyPart = { text: string; mention: boolean }

export function bodyParts(text: string, members: MentionMember[]): BodyPart[] {
  const handles = new Set(members.map(handleOf))
  return text
    .split(/((?:^|(?<=\s))@[\w.-]+)/)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, mention: part.startsWith('@') && handles.has(part.slice(1).replace(/[.]+$/, '')) }))
}

// A blank line starts a new paragraph. A mention is never split, so it stays one highlighted part.
export function paragraphsOf(parts: BodyPart[]): BodyPart[][] {
  const paragraphs: BodyPart[][] = [[]]
  for (const part of parts) {
    if (part.mention) {
      paragraphs[paragraphs.length - 1].push(part)
      continue
    }
    part.text.split(/\n[ \t]*\n\s*/).forEach((piece, index) => {
      if (index > 0) paragraphs.push([])
      if (piece !== '') paragraphs[paragraphs.length - 1].push({ text: piece, mention: false })
    })
  }
  return paragraphs.filter((paragraph) => paragraph.length > 0)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
