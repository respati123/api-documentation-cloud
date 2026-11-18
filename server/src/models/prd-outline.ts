export interface OutlineStory {
  title: string
  description: string
  acceptanceCriteria: string
  sourceSection: string | null
}

export interface OutlineEpic {
  title: string
  description: string
  sourceSection: string | null
  stories: OutlineStory[]
}

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const ACCEPTANCE = /^\s*(?:\*\*|__)?acceptance criteria(?:\*\*|__)?\s*:?\s*$/i
const TITLE_MAX = 180
const SECTION_MAX = 300
const TEXT_MAX = 20_000

// Reads the headings of a markdown PRD as a backlog outline: a level-2 heading is an epic and a level-3 heading under
// it is a story. The text under a heading is its description, and the text after an "Acceptance criteria" line in a
// story is its acceptance criteria. A story before the first epic goes under an epic named after the document.
// Headings inside a code fence are plain text, and a level-1 heading (the title) is ignored.
export function outlineFromMarkdown(content: string, documentTitle: string): OutlineEpic[] {
  const epics: OutlineEpic[] = []
  const bodies = new Map<object, string[]>()
  let current: OutlineEpic | OutlineStory | null = null
  let epic: OutlineEpic | null = null
  let inFence = false

  const open = (item: OutlineEpic | OutlineStory) => {
    current = item
    bodies.set(item, [])
  }

  for (const line of content.split(/\r?\n/)) {
    if (line.trim().startsWith('```')) inFence = !inFence
    const heading = inFence ? null : HEADING.exec(line)
    const level = heading ? heading[1].length : 0

    if (level === 2) {
      epic = { title: titleOf(heading![2]), description: '', sourceSection: sectionOf(heading![2]), stories: [] }
      epics.push(epic)
      open(epic)
    } else if (level === 3) {
      if (!epic) {
        epic = { title: titleOf(documentTitle), description: '', sourceSection: null, stories: [] }
        epics.push(epic)
        open(epic)
      }
      const story: OutlineStory = { title: titleOf(heading![2]), description: '', acceptanceCriteria: '', sourceSection: sectionOf(heading![2]) }
      epic.stories.push(story)
      open(story)
    } else if (level !== 1 && current) {
      bodies.get(current)?.push(line)
    }
  }

  for (const item of epics) {
    item.description = describe(bodies.get(item) ?? [])
    for (const story of item.stories) {
      const lines = bodies.get(story) ?? []
      const split = lines.findIndex((line) => ACCEPTANCE.test(line))
      story.description = describe(split === -1 ? lines : lines.slice(0, split))
      story.acceptanceCriteria = split === -1 ? '' : describe(lines.slice(split + 1))
    }
  }
  return epics
}

const titleOf = (text: string) => text.trim().slice(0, TITLE_MAX)
const sectionOf = (text: string) => text.trim().slice(0, SECTION_MAX)
const describe = (lines: string[]) => lines.join('\n').trim().slice(0, TEXT_MAX)
