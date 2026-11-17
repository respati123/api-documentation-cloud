import { describe, expect, test } from 'bun:test'
import { guideFor } from '@/services/mcp-guides'

function prdStep(guide: string): string {
  const start = guide.indexOf('## Step 2. Write the PRD')
  return guide.slice(start, guide.indexOf('## Step 3.', start))
}

describe('PM playbook, PRD step', () => {
  const step = prdStep(guideFor(['pm']))

  test('follows the Confluence product requirements template, in order', () => {
    const headings = ['Product overview', 'Objective', 'Success metrics', 'Assumptions', 'Milestones', 'Requirements', 'Out of scope', 'Design', 'Technical decisions', 'Open questions', 'Reference links']
    const positions = headings.map((heading) => step.search(new RegExp(`\\d+\\. ${heading}:`)))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  test('writes the template tables, with requirement ids epics can quote', () => {
    expect(step).toContain('| Goal | Metric |')
    expect(step).toContain('| ID | Requirement | User story | Importance | Jira issue | Notes |')
    expect(step).toContain('| Question | Answer | Date answered |')
    expect(step).toContain('"R1 | <requirement>"')
    expect(step).toContain('team_members_list')
  })

  test('synthesizes instead of interviewing, and keeps file paths and code out', () => {
    expect(step).toContain('Do not interview the person')
    expect(step).toContain('No file paths or code')
    expect(step).toContain('As <actor>, I want <feature>, so that <benefit>')
  })

  test('asks for as few test seams as possible, at the highest level', () => {
    expect(step).toContain('as few places as possible')
    expect(step).toContain('confirm the technical decisions')
  })
})

describe('PM playbook, epic step', () => {
  test('quotes a requirement row from its id through the requirement text', () => {
    const guide = guideFor(['pm'])
    const step = guide.slice(guide.indexOf('## Step 3.'), guide.indexOf('## Step 4.'))
    expect(step).toContain('"R1 | <requirement>"')
  })
})

describe('discussion rules', () => {
  test('every agent learns to read the thread first, reply with parentId, and mention by handle from the team list', () => {
    for (const role of ['pm', 'backend', 'qa'] as const) {
      const guide = guideFor([role])
      expect(guide).toContain('discussion_read')
      expect(guide).toContain('parentId')
      expect(guide).toContain('team_members_list')
      expect(guide).toContain('@handle')
    }
  })
})

describe('tech lead playbook', () => {
  test('reviews the implementation and testing decisions of PRD drafts', () => {
    expect(guideFor(['tech_lead'])).toContain('Technical decisions')
  })
})
