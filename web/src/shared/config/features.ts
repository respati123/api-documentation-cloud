// The agile project screens (backlog, sprints) read the issue tables, which stay empty until the data move runs.
// They are built into the page only when this is switched on at build time, in the release that moves the data.
export const AGILE_PROJECT_ENABLED = import.meta.env.VITE_AGILE_PROJECT === 'true'

// CLOUD-001: the screens of the team artifact standard (ticket codes, the ticket panel, role lanes, the timeline).
// They stay out of the page until the whole set is ready and this is switched on at build time.
export const ARTIFACT_STANDARD_ENABLED = import.meta.env.VITE_ARTIFACT_STANDARD === 'true'
