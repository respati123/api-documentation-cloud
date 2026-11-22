import { describe, expect, test } from 'bun:test'
import { guideFor, promptsFor } from '@/services/mcp-guides'

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

describe('the team standard in the playbooks', () => {
  test('every agent learns the order of approvals, Given / When / Then, and that grilling stays local', () => {
    for (const role of ['pm', 'tech_lead', 'backend', 'qa'] as const) {
      const guide = guideFor([role])
      expect(guide).toContain('spec approved by the PM, then design approved by the tech lead')
      expect(guide).toContain('Given / When / Then')
      expect(guide).toContain('Never upload a grilling transcript')
    }
  })

  test('the PM playbook leads with the standard flow and names every spec section', () => {
    const guide = guideFor(['pm'])
    expect(guide.indexOf('## The standard flow')).toBeLessThan(guide.indexOf('## The older BRD and PRD flow'))
    for (const section of ['problem', 'goals', 'users', 'decisions', 'businessRules', 'flows', 'nonFunctional', 'impact', 'dependencies', 'outOfScope', 'openQuestions']) expect(guide).toContain(`- ${section}:`)
    expect(guide).toContain('acceptance_criterion_strike')
    expect(guide).not.toContain('Create tasks with planning_draft_task')
  })

  test('the tech lead playbook holds the ticket rules and all nine Definition of Ready items', () => {
    const guide = guideFor(['tech_lead'])
    expect(guide).toContain('One ticket is one mergeable pull request in one repo')
    for (const item of ['1. Goal, scope', '2. Parent criteria', '3. Spec, design', '4. Dependencies', '5. Design notes', '6. Code areas', '7. Required tests', '8. Size S or M', '9. No blocking']) expect(guide).toContain(item)
    expect(guide).toContain('Set assigneeId only after a person confirms it')
  })

  test('engineers read their ticket and add sub-tasks, QA writes a test case per criterion', () => {
    for (const role of ['backend', 'frontend', 'ui_ux', 'qa'] as const) {
      expect(guideFor([role])).toContain('ticket_read')
      expect(guideFor([role])).toContain('subtask_add')
    }
    expect(guideFor(['qa'])).toContain('criterion_test_case_write')
  })
})

describe('prompts', () => {
  test('the PM gets the spec prompt and no task prompt; the tech lead gets design and ticket prompts', () => {
    const pmNames = promptsFor(['pm']).map((prompt) => prompt.name)
    expect(pmNames).toContain('pm_spec_to_epic')
    expect(pmNames).not.toContain('pm_story_to_tasks')
    expect(promptsFor(['tech_lead']).map((prompt) => prompt.name)).toEqual(['tl_design_epic', 'tl_split_tickets', 'pm_story_to_tasks'])
  })
})
