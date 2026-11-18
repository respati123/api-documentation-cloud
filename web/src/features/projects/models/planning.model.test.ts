import { describe, expect, test } from 'vitest'
import { planningItemSchema } from '@/features/projects/models/planning.model'

const item = (status: string) => ({
  id: 'a',
  kind: 'epic',
  parentId: null,
  title: 'Payment',
  description: '',
  acceptanceCriteria: '',
  status,
  publishedAt: null,
  sourceDocumentId: null,
  sourceVersion: null,
  sourceOutdated: null,
  sourceSection: null,
  participantIds: [],
})

describe('planningItemSchema status', () => {
  test('keeps the statuses these screens know', () => {
    for (const status of ['draft', 'refinement', 'ready', 'in_progress', 'review', 'done']) {
      expect(planningItemSchema.parse(item(status)).status).toBe(status)
    }
  })

  test('reads the statuses of the issue model as the old ones, so the old screens still open', () => {
    expect(planningItemSchema.parse(item('todo')).status).toBe('ready')
    expect(planningItemSchema.parse(item('in_design')).status).toBe('refinement')
    expect(planningItemSchema.parse(item('in_qa')).status).toBe('review')
  })

  test('still refuses a status it does not know', () => {
    expect(planningItemSchema.safeParse(item('archived')).success).toBe(false)
  })
})
