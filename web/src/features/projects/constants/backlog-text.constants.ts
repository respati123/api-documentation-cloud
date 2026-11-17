// Locale keys for the backlog screen. The words live in shared/i18n/locales/*/planning.json, under "backlog".
export const BACKLOG_TEXT = {
  title: 'planning:backlog.title',
  subtitle: 'planning:backlog.subtitle',
  productGoal: 'planning:backlog.productGoal',
  noGoal: 'planning:backlog.noGoal',
  epicsHeading: 'planning:backlog.epicsHeading',
  epicsLabel: 'planning:backlog.epicsLabel',
  allEpics: 'planning:backlog.allEpics',
  noEpic: 'planning:backlog.noEpic',
  sprint: {
    planned: 'planning:backlog.sprint.planned',
    active: 'planning:backlog.sprint.active',
    dates: 'planning:backlog.sprint.dates',
    daysLeft: 'planning:backlog.sprint.daysLeft',
    noGoal: 'planning:backlog.sprint.noGoal',
    totals: 'planning:backlog.sprint.totals',
    doneTotals: 'planning:backlog.sprint.doneTotals',
    empty: 'planning:backlog.sprint.empty',
  },
  section: {
    title: 'planning:backlog.section.title',
    count: 'planning:backlog.section.count',
    empty: 'planning:backlog.section.empty',
    emptyFiltered: 'planning:backlog.section.emptyFiltered',
  },
  type: {
    epic: 'planning:backlog.type.epic',
    story: 'planning:backlog.type.story',
    task: 'planning:backlog.type.task',
    bug: 'planning:backlog.type.bug',
    subtask: 'planning:backlog.type.subtask',
  },
  status: {
    draft: 'planning:backlog.status.draft',
    in_design: 'planning:backlog.status.in_design',
    ready: 'planning:backlog.status.ready',
    todo: 'planning:backlog.status.todo',
    in_progress: 'planning:backlog.status.in_progress',
    in_qa: 'planning:backlog.status.in_qa',
    in_review: 'planning:backlog.status.in_review',
    done: 'planning:backlog.status.done',
  },
  points: 'planning:backlog.points',
  noPoints: 'planning:backlog.noPoints',
  gap: { status: 'planning:backlog.gap.status', points: 'planning:backlog.gap.points' },
  ready: 'planning:backlog.ready',
  unpublished: 'planning:backlog.unpublished',
  outdated: 'planning:backlog.outdated',
  unassigned: 'planning:backlog.unassigned',
  error: 'planning:backlog.error',
  retry: 'planning:backlog.retry',
} as const

// The key of the word for a status. A status this page has no word for shows as To do rather than as a raw key.
export const statusTextKey = (status: string): string =>
  status in BACKLOG_TEXT.status ? BACKLOG_TEXT.status[status as keyof typeof BACKLOG_TEXT.status] : BACKLOG_TEXT.status.todo
