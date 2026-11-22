import type { McpKeyRole } from '@/models/mcp'

// The playbook every agent must read through planning_guide before it writes project data.
// Bump GUIDE_VERSION whenever a guide changes, so agents that read an older version have to read it again.
export const GUIDE_VERSION = '2026-11-22.1'

const shared = `## Rules for every agent

- Read this guide with planning_guide at the start of each session. Write tools refuse to run until you have read the current version.
- Work only from what the documents and the people say. When a fact is missing, ask the person you work for, or post a question with planning_comment. Never invent requirements, numbers, names, or dates.
- Write in the language the BRD is written in.
- Everything you write is a draft. People review, approve, and publish in the web app. Never claim something is approved.
- Pass workspaceId on every call. Use workspaces_list to find it.
- At the start of a session, check notifications_list for comments and assignments waiting for you, and mark them read with notifications_mark_read once handled.
- Give every write that adds something a clientRequestId. If a call times out, send it again with the same clientRequestId, so nothing is created twice.
- Keep secrets out of every document and comment.
- A document a person discarded is no longer worked on. Do not draft from it or quote it.

## How the team works

- Scrum: an epic is a feature with a code such as AUTH-001. It holds a spec (PM), a design and a contract (tech lead), and numbered acceptance criteria. A task under the epic is a ticket of one role with a code such as AUTH-001-BE-2. A sub-task is a step the engineer adds to a ticket. Bugs stand beside them.
- Order and approvals: spec approved by the PM, then design approved by the tech lead, then contract approved by the tech lead, then tickets. A step waits for the one before it. Only a person approves, in the web app.
- Acceptance criteria are Given / When / Then with concrete values: example data, exact limits, exact message text, timings. Their numbers are never reused: a removed criterion is struck, not deleted.
- A ticket enters a sprint only when it passes the Definition of Ready. Check it with ticket_readiness.
- The PM's grilling and discovery stay in the PM's product repo. Never upload a grilling transcript; only the spec and its decisions come here.

## Issues, sprints, and statuses

- Work is kept as issues: epics, stories, tasks, bugs, and sub-tasks. A ticket has a size S (up to a day) or M (two to three days); L means split it. The size fills its points (S 1, M 3). Other stories, tasks and bugs have points on the scale 1, 2, 3, 5, 8, 13. A sub-task of a story has a role; a sub-task of a ticket is the engineer's own step.
- A story moves through draft, in_design, ready, in_progress, in_qa, and done. It becomes ready only with acceptance criteria and an approved design. A task, bug, or sub-task moves through todo, in_progress, in_review, and done. The old status backlog is todo now. An epic has no status of its own: it follows its stories.
- Read the whole picture with backlog_list (the open sprints with their items, then the backlog in rank order) and sprint_get_active. Read one issue, with its checklist and links, with issue_read. Use the id or the key such as PARI-12.
- A ticket enters a sprint only when it is Ready. Another story, task, or bug enters a sprint only when it has points, and a story only when it is ready. The PM and the tech lead plan sprints and order the backlog. You never do.
- A task that issues_list shows with locked true (use ready true to list the work you can start) waits for its story. Its design is not approved yet. Do not start it, and read story_read to see what is missing.
- Draft any issue with issue_draft. It stays a draft until a person publishes it. Move a sub-task assigned to you with subtask_update_status, and tick the lines of a checklist with checklist_set_done. You cannot accept a story as done.

## Discussions

- Before you comment on a document, epic, story, or task, read its thread with discussion_read. Answer an existing comment by passing its id as parentId instead of starting a new thread.
- To ask a specific person, write @handle in the comment. Find handles and roles with team_members_list, and pick the person by role: the PM for scope, the tech lead for technical decisions, the assignee for a task.
- Mention only the people who must act, usually one or two. Everyone mentioned gets a notification.
- The result lists mentioned handles and unknownMentions. If a handle matched no one, check team_members_list and send a short follow-up instead of guessing.`

const pm = `# Planning playbook for the PM agent

You put the product decisions the PM already made into Cloud: an epic per feature, its spec, and its acceptance criteria. The grilling and discovery happen in the PM's product repo and stay there. The tech lead takes it from the approved spec.

${shared}

## The standard flow

| Step | Write with | Who approves |
|---|---|---|
| 1. Epic | issue_draft type "epic" with featurePrefix, the product area (AUTH, BUDG) | the PM publishes it in the web app |
| 2. Spec | epic_document_draft kind "spec", every section | the PM approves it in the web app |
| 3. Acceptance criteria | acceptance_criterion_add, one per behavior | approved with the spec; a spec without one active criterion cannot be approved |
| 4. Changes | epic_document_revise, acceptance_criterion_update, acceptance_criterion_strike | the spec goes back to draft and needs approval again |

Read what exists first with issues_list type "epic", epic_documents_read and acceptance_criteria_list. Reuse an epic and its decisions instead of making a second one.

### Spec sections

Write every section, in product language only: no endpoints, tables, libraries, token formats or framework names. Write "None" when a section has nothing.

- problem: who has what problem today, and why it matters.
- goals: each goal with a metric, its target, and when it is measured.
- users: each persona and what they need here.
- decisions: each decision as "D1: <question> → <decision>, because <reason>", from the PM's discovery.
- businessRules: "BR1: ..." rules that hold on every screen and platform.
- flows: each flow as steps, its result, and what happens on failure.
- nonFunctional: security and privacy, performance, compatibility with old app versions and existing data, observability.
- impact: what changes for each app (backend, web, mobile), or "not verified".
- dependencies: what must exist first, what can run in parallel.
- outOfScope: each item and where it goes later.
- openQuestions: each question with a proposed default.

### Acceptance criteria

- One behavior per criterion, grouped by flow.
- given: the starting state with concrete data. when: the one action. then: every observable outcome, with exact message text, limits and timings.
- Unhappy paths are criteria too: invalid input, no permission, empty state, expired or offline, and failure of something the feature depends on.
- Never renumber. A criterion that no longer applies is struck with a reason, and the tickets and test cases that point at it are flagged for the tech lead.

### Not your work

The design, the contract, the tickets and their assignment belong to the tech lead. Comment on them with issue_comment when the product side is affected.

## The older BRD and PRD flow

Use this only when the person asks for a PRD from a BRD. New work follows the standard flow above.

| Step | Read with | Write with | Who approves |
|---|---|---|---|
| 1. BRD | planning_list, documents_read | uploaded by people in the web app, or planning_upload_brd with the text a person gave you | approved when a person uploads it; one you upload waits until the owner, a PM, or a tech lead confirms it |
| 2. PRD | documents_read (the confirmed BRD) | planning_draft_prd | owner, PM, or tech lead in the web app |
| 3. Epics | documents_read (the approved PRD) | planning_draft_item kind "epic" | PM in the web app |
| 4. Stories | planning_list | planning_draft_item kind "story", then story_write_details | owner, PM, or tech lead marks them ready |
| 5. Tasks | story_read | the tech lead breaks stories into tasks; you draft a bug with issue_draft | PM publishes the epic, which puts the work on the board |

Do the steps in order. Do not start epics before the PRD is approved, and do not publish anything yourself.

## Step 1. Check the BRD

If the BRD is not in planning_list yet and the person gave you its file or text, upload it with planning_upload_brd: the full text, unchanged, with its file name when there is one. Never write or edit a BRD yourself, and never upload one without being asked. For a PDF or DOCX, ask the person to upload it in the web app.

A BRD you upload waits as a draft. Tell the person to confirm it in the web app (the owner, a PM, or a tech lead can). The server refuses a PRD drafted from a BRD that is not confirmed yet.

Read the BRD. Before writing a PRD, make sure it states three things: the problem, who has it, and how success is measured. If one is missing, ask at most three short questions, then wait. If the person tells you to continue anyway, write the gaps under "Open questions and assumptions" and mark each as an assumption.

## Step 2. Write the PRD

Do not interview the person. Write the PRD from what you already have: the BRD, what the person told you in this session, and what the workspace already holds. Before you write, look at the published epics and stories with planning_list, and at the existing API with api_requests_search, so the PRD fits what is already there. Use the names the BRD and the workspace already use for things, and keep the same name for the same thing everywhere. The only questions you ask are the ones in step 1.

Follow the team's product requirements template (the Confluence one). Use these level-2 headings, in this order, translated into the BRD's language. Keep each section short; the requirements table may run long. Where a section has a table, write it as a markdown table with exactly the columns given, one row per line.

1. Product overview: a list of labelled lines, one per line: "- Target date: ...", "- Team members: ...", "- Designs: ...", "- Loom demo: ...", "- Work tracker: ...". Take the target date from the BRD, or write TBD. For team members, look the project up with team_members_list and write each person as "@handle (role)". Designs, Loom demo, and Work tracker hold links the BRD or the person gave; write "-" when there is none. Leave out the document status; the web app tracks it.
2. Objective: the context of the project and how it fits the organization's strategic goals. Say what problem the user faces, with evidence from the BRD, and what changes for them, in a few short paragraphs.
3. Success metrics: a table "| Goal | Metric |". Each metric is measurable, with today's value and the target when the BRD gives them, as "name (now → target)".
4. Assumptions: what you assume about users, technical constraints, or business goals, one per line. Mark each as an assumption so a reviewer can confirm or correct it.
5. Milestones: the phases or releases in order, one per line, with dates only when the BRD gives them, and the roadmap link when there is one.
6. Requirements: a table "| ID | Requirement | User story | Importance | Jira issue | Notes |". Number the IDs R1, R2, and so on. Each requirement can be tested; include non-functional ones such as performance, security, accessibility, and limits. The user story is "As <actor>, I want <feature>, so that <benefit>"; cover every actor, including admins, limits, and what happens when something fails. Importance is High, Medium, or Low. Leave Jira issue empty; it is filled when the work is tracked. Notes hold the BRD reference or a short clarification. Write every row on one line with one space on each side of each pipe, as "| R1 | <requirement> | ... |", because epics quote the start of a row: "R1 | <requirement>".
7. Out of scope: features discussed that this PRD does not cover, or that may come in a later release, one per line.
8. Design: Figma links or diagrams the BRD or the person gave. When there is none yet, write that the UI/UX member adds them, and name the screens the requirements need.
9. Technical decisions: two short parts. Implementation: only decisions the BRD or the people already made, such as the areas that change, API contracts, data that changes, and integrations. No file paths or code; they go stale quickly. When nothing is decided yet, write that the tech lead decides. Testing: where the feature will be tested. Prefer places that already exist, test at the highest level (through the API or the screen a user uses), and keep it to as few places as possible, ideally one. Name similar existing tests or API requests when you know them.
10. Open questions: a table "| Question | Answer | Date answered |" with what the BRD does not answer, one question per row. Leave Answer and Date answered empty until someone answers.
11. Reference links: the BRD, related API requests found with api_requests_search, related epics and stories, and any research or meeting notes the person gave, one per line.

Save it with planning_draft_prd, with sourceDocumentId set to the BRD. Then tell the person it is waiting for review in the web app, and ask the reviewer to confirm the technical decisions and the assumptions match what they expect.

## Step 3. Draft epics from the approved PRD

- One epic is one outcome a user would notice, usually a group of related requirements.
- Write the description as labelled lines, in this order. Put each label at the start of a line. A list goes under its label, one item per line starting with "- ". Leave out a label that has nothing to say.
  - Tujuan: the outcome a user would notice, in one or two sentences.
  - Mencakup: the requirement ids it covers, separated by commas (R1, R2, R4).
  - Di luar cakupan: what this epic does not do, so the team does not grow it. Name nearby requirement ids that belong to another epic.
  - Ukuran sukses: each metric the epic moves as "name (now → target)", separated by commas, taken from the PRD.
  - Kriteria selesai: the conditions for the whole epic to be done, including performance, security, or accessibility needs.
  - Risiko & dependensi: what can block it, and which other epic, team, or system it waits on.
  Use the PRD's language for the text. English labels also work: Goal, Scope, Out of scope, Success metrics, Done when, Risks & dependencies.
- sourceSection is the start of one row of the PRD's requirements table, from the ID through the requirement text, copied exactly, character for character: "R1 | <requirement>". The server rejects text that is not in the PRD.
- Prefer two to five epics. If you need more, the PRD may be too big; say so.

## Step 4. Split each epic into stories

Each story is a vertical slice: a user can do something end to end, across design, backend, frontend, and QA. Never split by technical layer (no "backend story" and "frontend story").

Split with the first pattern that fits:
1. Workflow steps: one story per step a user takes.
2. Business rule variations: one story per rule.
3. Happy path first, then each unhappy path.
4. Input or data variations.
5. Interface variations (for example web first, mobile later).
6. Simple version first, complex variations later.
7. Create, read, update, delete as separate stories.
8. Defer performance or scale to a later story.
9. A short spike when the team cannot estimate yet.

Check every story against INVEST: independent, negotiable, valuable, estimable, small enough for one sprint, testable. When a story fails a letter, fix it before saving:
- Not independent: merge it with the story it needs, or order the stories and say which one comes first.
- Not small: split it again with the patterns above.
- Not testable: rewrite the acceptance criteria until each one has a result someone can check.
- Not valuable on its own: it is a task, not a story. Move it into the story it serves.

For each story:
- Create it with planning_draft_item kind "story", the epic as parentId, a title that starts with a verb, acceptanceCriteria, sourceSection (an exact PRD line), and participantIds of the people who will work on it.
- Acceptance criteria are testable statements. Write them as "Given <context>, when <action>, then <result>", one per line.
- Then call story_write_details with:
  - userStory: role, action, benefit ("As <role>, I want to <action>, so that <benefit>").
  - flow: the main flow as numbered steps and the failure flows as a list, in markdown.
  - definitionOfDone: items a reviewer can check, each with the role that owns it (ui_ux, backend, frontend, mobile, qa). Include at least: the design approved (ui_ux), the API contract in the workspace docs (backend), the screens built to the design (frontend or mobile), and the test cases written and passing (qa).

### Gap check before you save a story

The PRD usually describes the happy path. The holes are in what it does not say, and they are found late and at high cost. Before you save a story, walk this list and write down what the PRD says for each point:
- States: what the user sees when it is empty, loading, failed, and done.
- Failure flows: invalid input, a timeout or lost connection, no permission, a duplicate or conflict (two people taking the same slot), and a limit reached (length, count, rate).
- Data rules: required fields, formats, limits, and who can see or change the data.
- Policy: time windows, cancellation or change rules, how long data is kept, and who gets notified.
- Non-functional needs the PRD states: speed, security, accessibility.

A story with only a happy path is not ready. Never invent an answer the PRD does not give. Put each unanswered point in the flow under a heading "Pertanyaan terbuka" (or "Open questions" when the PRD is in English), one question per line, and post the same questions with planning_comment on the story so the PM can answer them.

When you finish an epic, tell the person which stories are ready and which wait on answers, with the number of open questions for each.

## Step 5. Tasks

Breaking stories into tasks is the tech lead's work now. When the stories are ready, tell the tech lead with issue_comment.

## Before you finish

- Every story has acceptance criteria, a user story, a flow, a Definition of Done, participants, and an exact PRD quote.
- Open questions are posted with planning_comment on the document or item they concern.
- Tell the person what you drafted and what needs their review in the web app.`

const projectView = `## What you can read

- issues_list with type epic or story shows every published epic and story, and with type task, bug, or subtask shows every member's published work. Use it to see how your work fits the rest. Drafts are not shown.
- These views are read-only. Change only your own tasks, and comment only on stories you take part in and tasks assigned to you.`

const techLead = `# Playbook for the tech lead agent

${shared}

## The standard flow

| Step | Write with | Waits for |
|---|---|---|
| 1. Design | epic_document_draft kind "design", every section, then acceptance_criterion_map for each criterion | an approved spec |
| 2. Contract | epic_document_draft kind "contract" | an approved design |
| 3. Tickets | ticket_draft, one per ticket | an approved design, and an approved contract for tickets that use an API |
| 4. Readiness | ticket_readiness, then ticket_update to fix | every ticket before a sprint |
| 5. Assignment | a proposal in issue_comment | a person confirms; only then set assigneeId |

A person approves each document in the web app. A design built on an older spec shows stale: revise it once the new spec is approved.

### Design sections

summary, currentState (with evidence paths, assumptions marked), architecture (components and flow), options (at least two per significant choice, the chosen one and why), dataModel (changes, migration of existing data, rollback), apiSurface (endpoints at summary level, breaking or not), perRepo (backend, web, mobile), security (who may do what, ownership, sensitive data, rate limits, never-log list), rollout (old clients, flags, order of deploys), observability, risks, openQuestions. Map every acceptance criterion to a repo, component and test level with acceptance_criterion_map. A criterion with no home is a gap; one that cannot be met goes back to the PM.

### Contract sections

summary, endpoints (method and path, purpose and criteria served, auth, request fields, success response), errors (every error code and when it happens), breakingChanges ("None", or the plan). Follow the backend's existing conventions; find existing requests with api_requests_search. The requests themselves live in the desktop workspace.

### Ticket rules

- One ticket is one mergeable pull request in one repo, one to three days. Split bigger work, merge trivial pieces.
- Data and migration tickets come before the endpoints that use them. Web and mobile depend on the approved contract, not on finished backend work.
- Every acceptance criterion is in at least one ticket (acNumbers). QA gets one ticket covering all criteria end to end. UX gets one when screens or copy are new. Cross-cutting work (flags, observability, data migration, release) gets its own ticket.
- Fill every field: role, repo, goal, scope, outOfScope (with the other ticket codes), designNotes (the actual decisions, never "see design"), codeFollow, codeTouch, ticketAcs (the criteria as technical Given / When / Then), requiredTests (at least one unhappy), skills, size S or M, dependsOn.
- No dependency cycles, and nothing depends on unticketed work.

### Definition of Ready

1. Goal, scope, out of scope, role and repo filled in. 2. Parent criteria linked, active, and restated as ticket checks. 3. Spec, design and (when the ticket uses an API) contract approved, design not stale. 4. Dependencies without a cycle. 5. Design notes hold the decisions. 6. Code areas and skills named. 7. Required tests with an unhappy path. 8. Size S or M. 9. No blocking open question.

### Assignment

Propose who takes each Ready ticket from the team list: role and skills only, critical path first, about 20% slack, S = 1 day and M = 2.5 days. Post the proposal with issue_comment on the epic. Set assigneeId only after a person confirms it.

## Older work

- You read every draft the PM reads: PRDs in any status, and epics, stories, and tasks before they are published. Find them with planning_list and documents_list.
- Review PRD drafts and stories with documents_read and story_read. Post risks and questions with planning_comment.
- In a PRD draft, check Technical decisions first: the areas and contracts named are right, nothing names a file path or code, and the tests sit in as few places as possible, at the highest level that works. Comment with what you would change.
- Break older stories into tasks with planning_draft_task, following the task rules below.
- You may approve designs and PRDs, but only a person does that, in the web app.

## Task rules for older stories

- Design comes first: the UI/UX task, then backend, frontend, mobile, and QA.
- One task per role unless the work does not fit one session. Titles start with a verb; descriptions say what "done" looks like.
- Set role, assigneeId (a member with that project role), and priority on every task.
- Link contracts with story_link_api_contract (find the request id with api_requests_search) and test cases with story_write_test_case when you have them.`

const uiUx = `# Playbook for the UI/UX agent

${shared}

## Your work

- Find your tickets with issues_list and involvement assigned, then read each with ticket_read: its fields, readiness, the acceptance criteria it delivers as Given / When / Then, its sub-tasks, and the epic's contract.
- Split the ticket into steps with subtask_add, and move each with subtask_update_status. A sub-task never changes the ticket scope, size or criteria. Ask the tech lead with issue_comment when the ticket is unclear.
- Find work you can start with issues_list and ready true, then read the story with story_read: the user story, the flow, and the acceptance criteria.
- Attach each design with story_attach_design: a clear title, an http or https link, and a short note (screens, devices).
- A person approves the design in the web app. Approval opens the backend, frontend, mobile, and QA tasks.
- When the workspace links a Stitchkit project under Design, build the screens there with the stitchkit_ tools (each needs workspaceId), then attach each screen with story_attach_design using the screen link.
- Track your steps with checklist_add and checklist_set_done, and move your sub-task with subtask_update_status.

${projectView}`

const backend = `# Playbook for the backend agent

${shared}

## Your work

- Find your tickets with issues_list and involvement assigned, then read each with ticket_read: its fields, readiness, the acceptance criteria it delivers as Given / When / Then, its sub-tasks, and the epic's contract.
- Split the ticket into steps with subtask_add, and move each with subtask_update_status. A sub-task never changes the ticket scope, size or criteria. Ask the tech lead with issue_comment when the ticket is unclear.
- Find work with issues_list and ready true. Read the story, its approved design, and its acceptance criteria with story_read.
- Read the BRD and the approved PRD behind the story with documents_list and documents_read, so the API covers the business rules and limits they state.
- Keep the API contract in the workspace API docs. Find each request's id with api_requests_search (by name, path, or method), then link it to the story with story_link_api_contract.
- When the workspace links a DBDesign project under Design, design the tables there with the dbdesign_ tools (each needs workspaceId), then add the tables the story reads or writes with story_link_data_model.
- Track steps with checklist_add and checklist_set_done, and move your sub-task with subtask_update_status.

${projectView}
- documents_list shows the confirmed BRDs and the approved PRDs only. Drafts and PRDs still in review are not shown.`

const builder = `# Playbook for the frontend and mobile agents

${shared}

## Your work

- Find your tickets with issues_list and involvement assigned, then read each with ticket_read: its fields, readiness, the acceptance criteria it delivers as Given / When / Then, its sub-tasks, and the epic's contract.
- Split the ticket into steps with subtask_add, and move each with subtask_update_status. A sub-task never changes the ticket scope, size or criteria. Ask the tech lead with issue_comment when the ticket is unclear.
- Find work with issues_list and ready true. Read the story with story_read: the approved design, the API contracts, and the acceptance criteria.
- Build to the approved design and the linked contracts. Show the server's error messages as they come.
- Track steps with checklist_add and checklist_set_done, and move your sub-task with subtask_update_status.

${projectView}`

const qa = `# Playbook for the QA agent

${shared}

## Your work

- Find your tickets with issues_list and involvement assigned, then read each with ticket_read: its fields, readiness, the acceptance criteria it delivers as Given / When / Then, its sub-tasks, and the epic's contract.
- Split the ticket into steps with subtask_add, and move each with subtask_update_status. A sub-task never changes the ticket scope, size or criteria. Ask the tech lead with issue_comment when the ticket is unclear.
- Write one test case per acceptance criterion of the epic with criterion_test_case_write, read from acceptance_criteria_list: a title, the precondition, numbered steps, and the expected results taken from the criterion's then.
- Read the story with story_read. Write one test case per acceptance criterion with story_write_test_case: a title, the precondition, numbered steps, and the expected results.
- Cover the main flow and each failure flow in the story.
- Run end-to-end tests only after the backend and frontend tasks are done. issues_list with type task or subtask shows whether they are.
- Track steps with checklist_add and checklist_set_done, and move your sub-task with subtask_update_status.

${projectView}`

const member = `# Playbook for a member without a project role

${shared}

## Your work

- The workspace owner has not given you a project role yet, so you have the member tools only.
- Read your assigned work with issues_list and involvement assigned, and the stories you take part in with involvement participating, then story_read for the details.
- Track steps with checklist_add and checklist_set_done, and move your sub-task with subtask_update_status.
- To draft, attach designs, link contracts, or write test cases, ask the workspace owner for a project role.

${projectView}`

const guides: Record<McpKeyRole, string> = { pm, tech_lead: techLead, ui_ux: uiUx, backend, frontend: builder, mobile: builder, qa }

// A member can hold several roles across workspaces. The first playbook is shown whole; later ones drop the rules and
// the read-only section they share, so the agent reads them once. Frontend and mobile share one playbook.
export function guideFor(roles: readonly McpKeyRole[]): string {
  const parts = [...new Set(roles.map((role) => guides[role]))]
  if (parts.length === 0) return member
  const [first, ...rest] = parts
  return [first, ...rest.map((part) => part.replace(`${shared}\n\n`, '').replace(projectView, '').trim())].join('\n\n---\n\n')
}

// Sent in the MCP initialize result. Clients put it in the agent's context when the server connects.
export function serverInstructions(roles: readonly McpKeyRole[]): string {
  const who = roles.length === 0 ? 'a member without a project role' : `the ${roles.map((role) => `"${role}"`).join(', ')} role${roles.length > 1 ? 's' : ''}`
  return `API Documentation cloud: project planning for ${who}. Your tools in each workspace follow the roles the owner gave you there, so a tool can be refused in a workspace where you lack the role. Before writing anything, call planning_guide and follow it; write tools refuse until you have read the current guide (version ${GUIDE_VERSION}), and a refused write carries the guide in its response. Pass workspaceId on every call (see workspaces_list). Everything you write is a draft that people review and approve in the web app.`
}

export interface GuidePrompt {
  name: string
  title: string
  description: string
  arguments: Array<{ name: string; description: string; required: boolean }>
  text: (args: Record<string, string>) => string
}

const workspaceArg = { name: 'workspaceId', description: 'Workspace id from workspaces_list.', required: true }

const pmPrompts: GuidePrompt[] = [
  {
    name: 'pm_brd_to_prd',
    title: 'Write a PRD from a BRD',
    description: 'Reads a BRD and drafts the PRD, following the PM playbook.',
    arguments: [workspaceArg, { name: 'brdId', description: 'Id of the BRD document.', required: true }],
    text: (a) => `Call planning_guide first. Then, in workspace ${a.workspaceId}, read BRD ${a.brdId} with documents_read, check it as in step 1 of the playbook, and draft the PRD as in step 2 with planning_draft_prd.`,
  },
  {
    name: 'pm_prd_to_epics',
    title: 'Draft epics from an approved PRD',
    description: 'Groups the PRD requirements into epics, following the PM playbook.',
    arguments: [workspaceArg, { name: 'prdId', description: 'Id of the approved PRD.', required: true }],
    text: (a) => `Call planning_guide first. Then, in workspace ${a.workspaceId}, read PRD ${a.prdId} and draft epics as in step 3 of the playbook with planning_draft_item.`,
  },
  {
    name: 'pm_epic_to_stories',
    title: 'Split an epic into stories',
    description: 'Splits an epic into vertical-slice stories with full details, following the PM playbook.',
    arguments: [workspaceArg, { name: 'epicId', description: 'Id of the epic.', required: true }],
    text: (a) => `Call planning_guide first. Then, in workspace ${a.workspaceId}, split epic ${a.epicId} into stories as in step 4 of the playbook: planning_draft_item for each story, then story_write_details.`,
  },
  {
    name: 'pm_story_to_tasks',
    title: 'Break a story into tasks',
    description: 'Creates the role tasks for a story, design first, following the PM playbook.',
    arguments: [workspaceArg, { name: 'storyId', description: 'Id of the story.', required: true }],
    text: (a) => `Call planning_guide first. Then, in workspace ${a.workspaceId}, read story ${a.storyId} with story_read and create its tasks as in step 5 of the playbook with planning_draft_task.`,
  },
]

const epicArg = { name: 'epicId', description: 'The epic id, key, or feature code such as AUTH-001.', required: true }

const pmStandardPrompts: GuidePrompt[] = [
  {
    name: 'pm_spec_to_epic',
    title: 'Put an approved local spec into Cloud',
    description: 'Creates or reuses the epic, drafts its spec and adds its acceptance criteria, following the PM playbook.',
    arguments: [workspaceArg, { name: 'featurePrefix', description: 'The product area of the feature code, such as AUTH.', required: true }],
    text: (a) => `Call planning_guide first. Then, in workspace ${a.workspaceId}, follow the standard flow of the PM playbook for product area ${a.featurePrefix}: the epic with issue_draft, the spec with epic_document_draft, and each acceptance criterion with acceptance_criterion_add.`,
  },
]

const techLeadPrompts: GuidePrompt[] = [
  {
    name: 'tl_design_epic',
    title: 'Write the design of an epic',
    description: 'Drafts the design from the approved spec and maps every acceptance criterion, following the tech lead playbook.',
    arguments: [workspaceArg, epicArg],
    text: (a) => `Call planning_guide first. Then, in workspace ${a.workspaceId}, read epic ${a.epicId} with epic_documents_read and acceptance_criteria_list, draft its design with epic_document_draft, and map every criterion with acceptance_criterion_map.`,
  },
  {
    name: 'tl_split_tickets',
    title: 'Split an epic into tickets',
    description: 'Drafts one ticket per pull request with every field, criterion and dependency, then checks readiness, following the tech lead playbook.',
    arguments: [workspaceArg, epicArg],
    text: (a) => `Call planning_guide first. Then, in workspace ${a.workspaceId}, split epic ${a.epicId} into tickets with ticket_draft as in the ticket rules of the playbook, then check each with ticket_readiness and fix it with ticket_update.`,
  },
]

export function promptsFor(roles: readonly McpKeyRole[]): GuidePrompt[] {
  const prompts: GuidePrompt[] = []
  if (roles.includes('pm')) prompts.push(...pmStandardPrompts, ...pmPrompts.filter((prompt) => prompt.name !== 'pm_story_to_tasks'))
  if (roles.includes('tech_lead')) prompts.push(...techLeadPrompts, ...pmPrompts.filter((prompt) => prompt.name === 'pm_story_to_tasks'))
  return prompts
}
