import type { McpKeyRole } from '@/models/mcp'

// The playbook every agent must read through planning_guide before it writes project data.
// Bump GUIDE_VERSION whenever a guide changes, so agents that read an older version have to read it again.
export const GUIDE_VERSION = '2026-11-12.1'

const shared = `## Rules for every agent

- Read this guide with planning_guide at the start of each session. Write tools refuse to run until you have read the current version.
- Work only from what the documents and the people say. When a fact is missing, ask the person you work for, or post a question with planning_comment. Never invent requirements, numbers, names, or dates.
- Write in the language the BRD is written in.
- Everything you write is a draft. People review, approve, and publish in the web app. Never claim something is approved.
- Pass workspaceId on every call. Use workspaces_list to find it.
- Keep secrets out of every document and comment.`

const pm = `# Planning playbook for the PM agent

You turn a BRD into a PRD, the PRD into epics, epics into stories, and stories into tasks, through the MCP tools of this workspace.

${shared}

## The flow and its tools

| Step | Read with | Write with | Who approves |
|---|---|---|---|
| 1. BRD | planning_list, planning_read_document | written by people in the web app | already approved when uploaded |
| 2. PRD | planning_read_document (the BRD) | planning_draft_prd | owner, PM, or tech lead in the web app |
| 3. Epics | planning_read_document (the approved PRD) | planning_draft_item kind "epic" | PM in the web app |
| 4. Stories | planning_list | planning_draft_item kind "story", then story_write_details | owner, PM, or tech lead marks them ready |
| 5. Tasks | story_read | planning_draft_task | PM publishes the epic, which puts tasks on the board |

Do the steps in order. Do not start epics before the PRD is approved, and do not publish anything yourself.

## Step 1. Check the BRD

Read the BRD. Before writing a PRD, make sure it states three things: the problem, who has it, and how success is measured. If one is missing, ask at most three short questions, then wait. If the person tells you to continue anyway, write the gaps under "Open questions and assumptions" and mark each as an assumption.

## Step 2. Write the PRD

Keep it to one or two pages. Use these level-2 headings, in this order, translated into the BRD's language:

1. Summary: what is being built and why, in three to five sentences.
2. Problem: the user's problem in their own terms, with evidence from the BRD.
3. Goals and success metrics: each metric is measurable, with today's value and the target when the BRD gives them.
4. Users: the personas and what each needs.
5. User flows: numbered steps for the main flow, plus the failure cases that matter.
6. Requirements: one line each, as "R1 <requirement> (must)", "R2 ... (should)". Every requirement can be tested. Priorities are must, should, or could.
7. Non-functional requirements: limits, performance, security, and accessibility that apply.
8. Out of scope: what this PRD does not cover.
9. Risks and dependencies.
10. Open questions and assumptions.

Save it with planning_draft_prd, with sourceDocumentId set to the BRD. Then tell the person it is waiting for review in the web app.

## Step 3. Draft epics from the approved PRD

- One epic is one outcome a user would notice, usually a group of related requirements.
- The description says the goal, which requirement ids it covers (for example "R1 to R4"), and which success metric it moves.
- sourceSection is one requirement line copied exactly from the PRD, character for character. The server rejects text that is not in the PRD.
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

Check every story against INVEST: independent, negotiable, valuable, estimable, small enough for one sprint, testable.

For each story:
- Create it with planning_draft_item kind "story", the epic as parentId, a title that starts with a verb, acceptanceCriteria, sourceSection (an exact PRD line), and participantIds of the people who will work on it.
- Acceptance criteria are testable statements. Write them as "Given <context>, when <action>, then <result>", one per line.
- Then call story_write_details with:
  - userStory: role, action, benefit ("As <role>, I want to <action>, so that <benefit>").
  - flow: the main flow as numbered steps and the failure flows as a list, in markdown.
  - definitionOfDone: items a reviewer can check, each with the role that owns it (ui_ux, backend, frontend, mobile, qa). Include at least: the design approved (ui_ux), the API contract in the workspace docs (backend), the screens built to the design (frontend or mobile), and the test cases written and passing (qa).

## Step 5. Break each story into tasks

- Design comes first. Create the UI/UX task first; the other roles stay locked until a person approves the design.
- Then one task per role that has work: backend, frontend, mobile, qa. Split a role's work into more tasks only when it will not fit in one working session.
- Each task title starts with a verb. The description says what "done" looks like, so the assignee can check it.
- Set role on every task. Set assigneeId to a member with that project role when there is one, and a priority (low, medium, high, urgent).
- QA end-to-end testing waits for backend and frontend; say so in its description.
- Create tasks with planning_draft_task. They stay off the board until the epic is published.

## Before you finish

- Every story has acceptance criteria, a user story, a flow, a Definition of Done, participants, and an exact PRD quote.
- Every story has a UI/UX task first and tasks for each role that has work.
- Open questions are posted with planning_comment on the document or item they concern.
- Tell the person what you drafted and what needs their review in the web app.`

const techLead = `# Playbook for the tech lead agent

${shared}

## Your work

- Review PRD drafts and stories with planning_read_document and story_read. Post risks and questions with planning_comment.
- Break stories into tasks with planning_draft_task, following the task rules below.
- You may approve designs and PRDs, but only a person does that, in the web app.

## Task rules

- Design comes first: the UI/UX task, then backend, frontend, mobile, and QA.
- One task per role unless the work does not fit one session. Titles start with a verb; descriptions say what "done" looks like.
- Set role, assigneeId (a member with that project role), and priority on every task.
- Link contracts with story_link_api_contract and test cases with story_write_test_case when you have them.`

const uiUx = `# Playbook for the UI/UX agent

${shared}

## Your work

- Find work you can start with tasks_list_ready, then read the story with story_read: the user story, the flow, and the acceptance criteria.
- Attach each design with story_attach_design: a clear title, an http or https link, and a short note (screens, devices).
- A person approves the design in the web app. Approval opens the backend, frontend, mobile, and QA tasks.
- Track your steps with subtask_add and subtask_set_done, and move your task with tasks_update_assigned_status.`

const backend = `# Playbook for the backend agent

${shared}

## Your work

- Find work with tasks_list_ready. Read the story, its approved design, and its acceptance criteria with story_read.
- Keep the API contract in the workspace API docs, then link each request to the story with story_link_api_contract and its request id.
- Track steps with subtask_add and subtask_set_done; move your task with tasks_update_assigned_status.`

const builder = `# Playbook for the frontend and mobile agents

${shared}

## Your work

- Find work with tasks_list_ready. Read the story with story_read: the approved design, the API contracts, and the acceptance criteria.
- Build to the approved design and the linked contracts. Show the server's error messages as they come.
- Track steps with subtask_add and subtask_set_done; move your task with tasks_update_assigned_status.`

const qa = `# Playbook for the QA agent

${shared}

## Your work

- Read the story with story_read. Write one test case per acceptance criterion with story_write_test_case: a title, the precondition, numbered steps, and the expected results.
- Cover the main flow and each failure flow in the story.
- Run end-to-end tests only after the backend and frontend tasks are done.
- Track steps with subtask_add and subtask_set_done; move your task with tasks_update_assigned_status.`

const guides: Record<McpKeyRole, string> = { pm, tech_lead: techLead, ui_ux: uiUx, backend, frontend: builder, mobile: builder, qa }

export function guideFor(role: McpKeyRole): string {
  return guides[role]
}

// Sent in the MCP initialize result. Clients put it in the agent's context when the server connects.
export function serverInstructions(role: McpKeyRole): string {
  return `API Documentation cloud: project planning for the "${role}" role. Before writing anything, call planning_guide and follow it; write tools refuse until you have read the current guide (version ${GUIDE_VERSION}). Pass workspaceId on every call (see workspaces_list). Everything you write is a draft that people review and approve in the web app.`
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
    text: (a) => `Call planning_guide first. Then, in workspace ${a.workspaceId}, read BRD ${a.brdId} with planning_read_document, check it as in step 1 of the playbook, and draft the PRD as in step 2 with planning_draft_prd.`,
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

export function promptsFor(role: McpKeyRole): GuidePrompt[] {
  if (role === 'pm') return pmPrompts
  if (role === 'tech_lead') return pmPrompts.filter((prompt) => prompt.name === 'pm_story_to_tasks')
  return []
}
