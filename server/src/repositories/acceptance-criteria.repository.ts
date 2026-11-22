import type { SQL } from 'bun'
import type { DesignMappingEntry } from '@/models/acceptance-criterion'

export interface AcceptanceCriterionRow {
  id: string
  epicId: string
  number: number
  flow: string
  title: string
  given: string
  when: string
  then: string[]
  designMapping: DesignMappingEntry[]
  status: 'active' | 'struck'
  struckReason: string | null
  struckAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface LinkedIssue {
  acId: string
  issueId: string
  key: string
  type: string
  title: string
}

export interface LinkedTestCase {
  acId: string
  id: string
  number: number
  title: string
}

const columns = `a.id, a.epic_id AS "epicId", a.number, a.flow, a.title, a.given_text AS given, a.when_text AS "when", a.then_items AS "then", a.design_mapping AS "designMapping", a.status, a.struck_reason AS "struckReason", a.struck_at AS "struckAt", a.created_at AS "createdAt", a.updated_at AS "updatedAt"`

const asJsonArray = (items: string[]) => JSON.stringify(items)

export async function listAcceptanceCriteria(db: SQL, epicId: string): Promise<AcceptanceCriterionRow[]> {
  return db`SELECT ${db.unsafe(columns)} FROM acceptance_criteria a WHERE a.epic_id = ${epicId} ORDER BY a.number`
}

export async function findAcceptanceCriterion(db: SQL, epicId: string, number: number): Promise<AcceptanceCriterionRow | undefined> {
  const [row] = await db`SELECT ${db.unsafe(columns)} FROM acceptance_criteria a WHERE a.epic_id = ${epicId} AND a.number = ${number}`
  return row
}

// The tasks and bugs that deliver each criterion of an epic.
export async function listLinkedIssues(db: SQL, epicId: string): Promise<LinkedIssue[]> {
  return db`SELECT l.ac_id AS "acId", i.id AS "issueId", p.key || '-' || i.number AS key, i.type, i.title
    FROM issue_acceptance_criteria l JOIN acceptance_criteria a ON a.id = l.ac_id JOIN issues i ON i.id = l.issue_id JOIN projects p ON p.id = i.project_id
    WHERE a.epic_id = ${epicId} ORDER BY i.number`
}

export async function listLinkedTestCases(db: SQL, epicId: string): Promise<LinkedTestCase[]> {
  return db`SELECT t.ac_id AS "acId", t.id, t.number, t.title FROM story_test_cases t JOIN acceptance_criteria a ON a.id = t.ac_id WHERE a.epic_id = ${epicId} ORDER BY t.number`
}

// Locks the epic row, so two criteria added at the same moment never take the same number.
export async function lockEpic(db: SQL, epicId: string): Promise<void> {
  await db`SELECT id FROM issues WHERE id = ${epicId} FOR UPDATE`
}

// Struck criteria keep their numbers, so the next number counts them too.
export async function insertAcceptanceCriterion(
  db: SQL,
  row: { id: string; epicId: string; flow: string; title: string; given: string; when: string; then: string[]; createdBy: string; apiKeyId: string | null },
): Promise<number> {
  const [inserted] = await db`INSERT INTO acceptance_criteria (id, epic_id, number, flow, title, given_text, when_text, then_items, created_by, api_key_id)
    VALUES (${row.id}, ${row.epicId}, (SELECT coalesce(max(number), 0) + 1 FROM acceptance_criteria WHERE epic_id = ${row.epicId}), ${row.flow}, ${row.title}, ${row.given}, ${row.when},
      ARRAY(SELECT jsonb_array_elements_text((${asJsonArray(row.then)}::text)::jsonb)), ${row.createdBy}, ${row.apiKeyId})
    RETURNING number`
  return Number(inserted.number)
}

export async function updateAcceptanceCriterion(db: SQL, id: string, fields: { flow: string; title: string; given: string; when: string; then: string[] }): Promise<void> {
  await db`UPDATE acceptance_criteria SET flow = ${fields.flow}, title = ${fields.title}, given_text = ${fields.given}, when_text = ${fields.when},
    then_items = ARRAY(SELECT jsonb_array_elements_text((${asJsonArray(fields.then)}::text)::jsonb)), updated_at = now() WHERE id = ${id}`
}

export async function strikeAcceptanceCriterion(db: SQL, id: string, reason: string): Promise<boolean> {
  const rows = await db`UPDATE acceptance_criteria SET status = 'struck', struck_reason = ${reason}, struck_at = now(), updated_at = now() WHERE id = ${id} AND status = 'active' RETURNING id`
  return rows.length > 0
}

export async function setDesignMapping(db: SQL, id: string, mapping: DesignMappingEntry[]): Promise<void> {
  await db`UPDATE acceptance_criteria SET design_mapping = (${JSON.stringify(mapping)}::text)::jsonb, updated_at = now() WHERE id = ${id}`
}

export async function listIssueCriterionIds(db: SQL, issueId: string): Promise<string[]> {
  const rows: Array<{ acId: string }> = await db`SELECT ac_id AS "acId" FROM issue_acceptance_criteria WHERE issue_id = ${issueId}`
  return rows.map((row) => row.acId)
}

// Replaces the criteria a task or bug delivers with the given ones.
export async function replaceIssueCriteria(db: SQL, issueId: string, acIds: string[], userId: string): Promise<void> {
  await db`DELETE FROM issue_acceptance_criteria WHERE issue_id = ${issueId}`
  for (const acId of acIds) {
    await db`INSERT INTO issue_acceptance_criteria (issue_id, ac_id, created_by) VALUES (${issueId}, ${acId}, ${userId})`
  }
}

export async function listIssueCriteria(db: SQL, issueId: string): Promise<AcceptanceCriterionRow[]> {
  return db`SELECT ${db.unsafe(columns)} FROM issue_acceptance_criteria l JOIN acceptance_criteria a ON a.id = l.ac_id WHERE l.issue_id = ${issueId} ORDER BY a.number`
}
