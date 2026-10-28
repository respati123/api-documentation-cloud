export const workspaceDetailKeys = {
  all: ['workspace-detail'] as const,
  detail: (token: string, workspaceId: string) => [...workspaceDetailKeys.all, 'detail', workspaceId, token] as const,
  invites: (token: string, workspaceId: string) => [...workspaceDetailKeys.all, 'invites', workspaceId, token] as const,
  commit: (token: string, workspaceId: string, commitId: string) =>
    [...workspaceDetailKeys.all, 'commit', workspaceId, commitId, token] as const,
}
