export const workspaceDetailKeys = {
  all: ['workspace-detail'] as const,
  detail: (token: string, workspaceId: string) => [...workspaceDetailKeys.all, 'detail', workspaceId, token] as const,
  history: (token: string, workspaceId: string) => [...workspaceDetailKeys.all, 'history', workspaceId, token] as const,
  members: (token: string, workspaceId: string) => [...workspaceDetailKeys.all, 'members', workspaceId, token] as const,
  invites: (token: string, workspaceId: string) => [...workspaceDetailKeys.all, 'invites', workspaceId, token] as const,
  commit: (token: string, workspaceId: string, commitId: string) =>
    [...workspaceDetailKeys.all, 'commit', workspaceId, commitId, token] as const,
}
