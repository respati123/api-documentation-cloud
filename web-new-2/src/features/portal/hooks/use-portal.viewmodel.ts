import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import type { ApiNode, WorkspaceSection } from '../models/portal.model'
import { findRequestById, readRoute, routeUrl, type PortalRoute } from '../utils/portal-route'
import { portalService as service } from '../services/portal.service'
import { portalKeys } from './portal.keys'
import { useWorkspaceTeamViewModel } from './use-workspace-team.viewmodel'
import { useWorkspaceSettingsViewModel } from './use-workspace-settings.viewmodel'
import { useMcpKeysViewModel } from './use-mcp-keys.viewmodel'
import { useNotificationsViewModel } from './use-notifications.viewmodel'
import { useAdminUsersViewModel } from './use-admin-users.viewmodel'
import { useAdminWorkspacesViewModel } from './use-admin-workspaces.viewmodel'

export function usePortalViewModel() {
  const client = useQueryClient()
  const params = new URLSearchParams(location.search)
  const [pendingInviteToken, setPendingInviteToken] = useState(
    location.pathname === '/invite' ? params.get('token') ?? '' : '',
  )
  const inviteAttempted = useRef(false)
  const [mode, setMode] = useState(
    location.pathname === '/join' ? 'register' : location.pathname.includes('reset-password') ? 'reset' : 'login',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // The URL is the source of truth for the section, the workspace, the selected request, and the history branch.
  const [route, setRoute] = useState<PortalRoute>(() => readRoute(location.pathname, location.search))
  const [branchState, setBranchState] = useState(route.page === 'workspace' ? route.branchId ?? '' : '')
  // Sample data is not in the workspace, so its selection stays in memory.
  const [sampleSelected, setSampleSelected] = useState<ApiNode | null>(null)
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const workspaceId = route.page === 'workspace' ? route.workspaceId : ''
  const tab: WorkspaceSection = route.page === 'workspace' ? route.tab : route.page === 'account' ? route.section : 'overview'
  const branchId = branchState

  const me = useQuery({ queryKey: portalKeys.me, queryFn: service.me, staleTime: 300000, retry: false })
  const authenticated = me.isSuccess
  const auth = useMutation({
    mutationFn: () => service.authenticate(mode, email, password, params.get('token') ?? ''),
    onSuccess: async () => {
      setPassword('')
      await client.invalidateQueries({ queryKey: portalKeys.me })
    },
  })
  const workspaces = useInfiniteQuery({
    queryKey: portalKeys.workspaces,
    queryFn: ({ pageParam }) => service.workspaces(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: authenticated,
    staleTime: 30000,
  })
  const items = workspaces.data?.pages.flatMap(page => page.items) ?? []
  const snapshot = useQuery({
    queryKey: portalKeys.detail(workspaceId, 'snapshot'),
    queryFn: () => service.snapshot(workspaceId),
    enabled: authenticated && !!workspaceId,
    staleTime: 30000,
  })
  // Moves to a route and writes its URL. Going back and forward reads the URL again (see popstate below).
  const navigate = (next: PortalRoute, replace = false) => {
    const url = routeUrl(next)
    if (replace) window.history.replaceState({}, '', url)
    else window.history.pushState({}, '', url)
    setSampleSelected(null)
    setRoute(next)
  }
  useEffect(() => {
    const onPopState = () => setRoute(readRoute(location.pathname, location.search))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  useEffect(() => {
    setBranchState(route.page === 'workspace' ? route.branchId ?? '' : '')
  }, [route])
  const leaveWorkspace = () => {
    navigate({ page: 'directory' })
    setSearch('')
  }
  const openWorkspace = (id: string) => {
    navigate(id ? { page: 'workspace', workspaceId: id, tab: 'overview' } : { page: 'directory' })
    setSearch('')
  }
  const setTab = (section: WorkspaceSection) => {
    if (section === 'mcp-key' || section === 'admin-mcp-keys' || section === 'admin-users' || section === 'admin-workspaces') {
      navigate({ page: 'account', section })
      return
    }
    if (!workspaceId) return
    navigate({ page: 'workspace', workspaceId, tab: section })
  }
  const selected: ApiNode | null = sampleSelected ?? findRequestById(snapshot.data?.tree ?? [], route.page === 'workspace' ? route.requestId : undefined)
  const setSelected = (node: ApiNode | null) => {
    if (route.page !== 'workspace') return
    if (node?.id.startsWith('sample-')) {
      navigate({ page: 'workspace', workspaceId: route.workspaceId, tab: route.tab })
      setSampleSelected(node)
      return
    }
    navigate({ ...route, requestId: node?.id })
  }
  const setBranchId = (value: string) => {
    setBranchState(value)
    if (route.page === 'workspace') navigate({ ...route, branchId: value }, true)
  }
  const workspace = snapshot.data ?? items.find(item => item.id === workspaceId)
  const team = useWorkspaceTeamViewModel({
    workspaceId,
    authenticated,
    canManage: workspace?.role === 'owner',
    currentUserId: me.data?.id,
    onLeave: leaveWorkspace,
  })
  const history = useInfiniteQuery({
    queryKey: portalKeys.detail(workspaceId, 'history'),
    queryFn: ({ pageParam }) => service.history(workspaceId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: authenticated && !!workspaceId && snapshot.isSuccess && snapshot.data?.usesBranches !== true,
    staleTime: 30000,
  })
  const branches = snapshot.data?.branches ?? []
  useEffect(() => {
    if (!branches.length) {
      setBranchState('')
      return
    }
    if (!branches.some(branch => branch.id === branchId)) setBranchState(branches[0].id)
  }, [branches, branchId])
  const branchHistory = useInfiniteQuery({
    queryKey: portalKeys.branchHistory(workspaceId, branchId),
    queryFn: ({ pageParam }) => service.branchHistory(workspaceId, branchId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: authenticated && !!workspaceId && !!branchId && snapshot.data?.usesBranches === true,
    staleTime: 30000,
  })
  const settings = useWorkspaceSettingsViewModel(workspaceId, leaveWorkspace)
  const mcpKeys = useMcpKeysViewModel({
    authenticated,
    isAdmin: me.data?.isAdmin === true,
    active: tab === 'mcp-key' || tab === 'admin-mcp-keys',
  })
  const notifications = useNotificationsViewModel(authenticated)
  const adminUsers = useAdminUsersViewModel({
    authenticated,
    isAdmin: me.data?.isAdmin === true,
    active: tab === 'admin-users',
    currentUserId: me.data?.id,
  })
  const adminWorkspaces = useAdminWorkspacesViewModel({
    authenticated,
    isAdmin: me.data?.isAdmin === true,
    active: tab === 'admin-workspaces',
    openWorkspace: id => openWorkspace(id),
  })
  useEffect(() => {
    if (!authenticated || tab !== 'mcp-key') mcpKeys.keys.clearSecret()
  }, [authenticated, tab, mcpKeys.keys.clearSecret])
  const acceptWorkspaceInvite = useMutation({
    mutationFn: (token: string) => service.acceptInvite(token),
    onSuccess: async workspaceResult => {
      setPendingInviteToken('')
      openWorkspace(workspaceResult.id)
      await client.invalidateQueries({ queryKey: portalKeys.workspaces })
    },
  })
  useEffect(() => {
    if (!authenticated || !pendingInviteToken || inviteAttempted.current) return
    inviteAttempted.current = true
    acceptWorkspaceInvite.mutate(pendingInviteToken)
  }, [authenticated, pendingInviteToken, acceptWorkspaceInvite.mutate])
  const create = useMutation({
    mutationFn: () => service.create(name.trim()),
    onSuccess: async workspaceResult => {
      setCreateOpen(false)
      setName('')
      openWorkspace(workspaceResult.id)
      await client.invalidateQueries({ queryKey: portalKeys.workspaces })
    },
  })
  const logout = useMutation({
    mutationFn: service.logout,
    onSuccess: () => {
      acceptWorkspaceInvite.reset()
      inviteAttempted.current = false
      client.clear()
      navigate({ page: 'directory' }, true)
      mcpKeys.keys.clearSecret()
    },
  })
  const anonymous = me.error instanceof ApiError && me.error.status === 401
  const changeMode = (value: string) => {
    setMode(value)
    auth.reset()
    setPassword('')
  }
  const retryWorkspaceInvite = () => {
    if (pendingInviteToken) acceptWorkspaceInvite.mutate(pendingInviteToken)
  }
  const dismissWorkspaceInvite = () => {
    setPendingInviteToken('')
    window.history.replaceState({}, '', '/')
  }

  return {
    me,
    anonymous,
    authenticated,
    mode,
    changeMode,
    email,
    setEmail,
    password,
    setPassword,
    auth,
    workspaces,
    items,
    workspaceId,
    openWorkspace,
    tab,
    setTab,
    search,
    setSearch,
    name,
    setName,
    createOpen,
    setCreateOpen,
    create,
    logout,
    snapshot,
    settings,
    mcpKeys,
    notifications,
    adminUsers,
    adminWorkspaces,
    members: team.members,
    team,
    history,
    branches,
    branchId,
    setBranchId,
    branchHistory,
    pendingInviteToken,
    acceptWorkspaceInvite,
    retryWorkspaceInvite,
    dismissWorkspaceInvite,
    selected,
    setSelected,
  }
}

export type PortalViewModel = ReturnType<typeof usePortalViewModel>
