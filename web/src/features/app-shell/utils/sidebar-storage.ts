// Storage can be blocked (private mode, cleared site data), so a sidebar group falls back to open.
const keyOf = (group: string) => `cloud.sidebar.${group}Expanded`

export function readGroupExpanded(group: string): boolean {
  try {
    return window.localStorage.getItem(keyOf(group)) !== 'false'
  } catch {
    return true
  }
}

export function writeGroupExpanded(group: string, expanded: boolean) {
  try {
    window.localStorage.setItem(keyOf(group), String(expanded))
  } catch {
    // The choice only lasts for this visit.
  }
}
