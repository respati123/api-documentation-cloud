// The agile project screens (backlog, sprints) read the issue tables, which stay empty until the data move runs.
// They are built into the page only when this is switched on at build time, in the release that moves the data.
export const AGILE_PROJECT_ENABLED = import.meta.env.VITE_AGILE_PROJECT === 'true'
