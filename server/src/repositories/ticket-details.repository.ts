import type { SQL } from 'bun'
import type { TicketDetails } from '@/models/ticket'

export interface TicketDetailsRow extends TicketDetails {
  issueId: string
  epicId: string
  roleCode: string | null
  ticketSeq: number | null
}

const columns = `issue_id AS "issueId", epic_id AS "epicId", role_code AS "roleCode", ticket_seq AS "ticketSeq", repo, goal, scope, design_notes AS "designNotes", code_follow AS "codeFollow", code_touch AS "codeTouch", ticket_acs AS "ticketAcs", required_tests AS "requiredTests", out_of_scope AS "outOfScope", skills, size, uses_api AS "usesApi", open_questions AS "openQuestions"`

export async function findTicketDetails(db: SQL, issueId: string): Promise<TicketDetailsRow | undefined> {
  const [row] = await db`SELECT ${db.unsafe(columns)} FROM issue_ticket_details WHERE issue_id = ${issueId}`
  return row
}

// The next number for a role in an epic. The caller locks the epic row first, so two tickets never share one.
export async function nextTicketSeq(db: SQL, epicId: string, roleCode: string): Promise<number> {
  const [row] = await db`SELECT coalesce(max(ticket_seq), 0) + 1 AS seq FROM issue_ticket_details WHERE epic_id = ${epicId} AND role_code = ${roleCode}`
  return Number(row.seq)
}

export async function saveTicketDetails(db: SQL, row: TicketDetailsRow): Promise<void> {
  const ticketAcs = JSON.stringify(row.ticketAcs)
  const requiredTests = JSON.stringify(row.requiredTests)
  const skills = JSON.stringify(row.skills)
  await db`INSERT INTO issue_ticket_details (issue_id, epic_id, role_code, ticket_seq, repo, goal, scope, design_notes, code_follow, code_touch, ticket_acs, required_tests, out_of_scope, skills, size, uses_api, open_questions)
    VALUES (${row.issueId}, ${row.epicId}, ${row.roleCode}, ${row.ticketSeq}, ${row.repo}, ${row.goal}, ${row.scope}, ${row.designNotes}, ${row.codeFollow}, ${row.codeTouch},
      (${ticketAcs}::text)::jsonb, (${requiredTests}::text)::jsonb, ${row.outOfScope}, ARRAY(SELECT jsonb_array_elements_text((${skills}::text)::jsonb)), ${row.size}, ${row.usesApi}, ${row.openQuestions})
    ON CONFLICT (issue_id) DO UPDATE SET epic_id = EXCLUDED.epic_id, role_code = EXCLUDED.role_code, ticket_seq = EXCLUDED.ticket_seq, repo = EXCLUDED.repo, goal = EXCLUDED.goal,
      scope = EXCLUDED.scope, design_notes = EXCLUDED.design_notes, code_follow = EXCLUDED.code_follow, code_touch = EXCLUDED.code_touch, ticket_acs = EXCLUDED.ticket_acs,
      required_tests = EXCLUDED.required_tests, out_of_scope = EXCLUDED.out_of_scope, skills = EXCLUDED.skills, size = EXCLUDED.size, uses_api = EXCLUDED.uses_api,
      open_questions = EXCLUDED.open_questions, updated_at = now()`
}
