const API_EXPANDED_KEY = 'cloud.sidebar.apiExpanded'

// Storage can be blocked (private mode, cleared site data), so the sidebar falls back to an open API group.
export function readApiExpanded(): boolean {
  try {
    return window.localStorage.getItem(API_EXPANDED_KEY) !== 'false'
  } catch {
    return true
  }
}

export function writeApiExpanded(expanded: boolean) {
  try {
    window.localStorage.setItem(API_EXPANDED_KEY, String(expanded))
  } catch {
    // The choice only lasts for this visit.
  }
}
