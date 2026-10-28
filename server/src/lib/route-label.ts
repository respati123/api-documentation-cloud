const identifierParents = new Set(['workspaces', 'members', 'invites', 'history', 'restore'])

export function routeLabel(path: string): string {
  const segments = path.replace(/\/+$/, '').split('/')
  return segments
    .map((segment, index) => (index > 0 && identifierParents.has(segments[index - 1]) ? ':id' : segment))
    .join('/')
}
