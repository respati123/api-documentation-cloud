import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Database,
  FolderClosed,
  FolderKanban,
  GitCommitHorizontal,
  LayoutGrid,
  Layers,
  UserCog,
  Palette,
  Search,
  Settings,
  UserRound,
  Users,
  Waypoints,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {  } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { ProductMark } from '@/components/product-mark'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuLabel,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import type { AppNotification, WorkspaceSection } from '../models/portal.model'
import type { PortalViewModel } from '../hooks/use-portal.viewmodel'
import { LanguageSelect } from './language-select.view'
import { NotificationsMenu } from './notifications-menu.view'
import { ErrorView } from './state.view'

export function PortalSidebarTrigger({
  placement,
  className,
}: {
  placement: 'desktop-header' | 'mobile-toolbar'
  className?: string
}) {
  const { t } = useTranslation()
  const { isMobile, openMobile, state } = useSidebar()
  const belongsHere = placement === 'mobile-toolbar' ? isMobile : !isMobile

  if (!belongsHere) return null

  return (
    <SidebarTrigger
      aria-label={t('sidebar.toggleNavigation')}
      aria-expanded={isMobile ? openMobile : state === 'expanded'}
      title={t('sidebar.toggleNavigation')}
      className={className}
      data-testid="portal-sidebar-trigger"
    />
  )
}

export function PortalSidebar({ vm }: { vm: PortalViewModel }) {
  const { t } = useTranslation()
  const { isMobile, toggleSidebar } = useSidebar()
  const [accountOpen, setAccountOpen] = useState(false)
  const workspace = vm.snapshot.data ?? vm.items.find(item => item.id === vm.workspaceId)
  const canManageSettings = workspace?.role === 'owner'
  const globalSection = vm.tab === 'mcp-key' || vm.tab === 'admin-mcp-keys' || vm.tab === 'admin-users' || vm.tab === 'admin-workspaces'
  const selectWorkspace = (id: string) => {
    vm.openWorkspace(id)
    if (isMobile) toggleSidebar()
  }
  const returnToWorkspaces = () => {
    selectWorkspace('')
  }
  const selectSection = (section: WorkspaceSection) => {
    vm.setTab(section)
    if (isMobile) toggleSidebar()
  }
  const openNotification = (notification: AppNotification) => {
    const match = notification.link.match(/^\/w\/([^/]+)\/projects\/?$/)
    if (!match) return
    let id: string
    try {
      id = decodeURIComponent(match[1])
    } catch {
      return
    }
    vm.openWorkspace(id)
    vm.setTab('projects')
    if (isMobile) toggleSidebar()
  }

  return (
    <Sidebar collapsible="icon" data-testid="portal-sidebar">
      <SidebarHeader className="gap-2 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={t('auth.brandName')}
              aria-label={t('auth.brandName')}
              onClick={returnToWorkspaces}
              data-testid="portal-home-button"
            >
              <ProductMark />
              <SidebarMenuLabel className="font-medium">{t('auth.brandName')}</SidebarMenuLabel>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {workspace && (
          <FieldDescription className="truncate px-2 text-xs group-data-[collapsible=icon]:hidden">
            {workspace.name}
          </FieldDescription>
        )}
        {!isMobile && ((!workspace && !globalSection) || vm.tab === 'collections') && (
          <>
            <FieldGroup className="px-2 pt-2 group-data-[collapsible=icon]:hidden">
              <Field>
                <FieldLabel htmlFor="portal-sidebar-search">{t('sidebar.search')}</FieldLabel>
                <Input
                  id="portal-sidebar-search"
                  aria-label={workspace ? t('sidebar.searchCollectionsOrRequests') : t('sidebar.searchWorkspaces')}
                  data-testid="portal-search-input"
                  placeholder={workspace ? t('sidebar.searchCollectionsPlaceholder') : t('shell.searchWorkspacesPlaceholder')}
                  value={vm.search}
                  onChange={event => vm.setSearch(event.target.value)}
                />
              </Field>
            </FieldGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={t('sidebar.search')}
                  aria-label={t('sidebar.search')}
                  className="hidden group-data-[collapsible=icon]:flex"
                  onClick={toggleSidebar}
                  data-testid="portal-search-expand-button"
                >
                  <Search aria-hidden="true" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        )}
      </SidebarHeader>

      <SidebarContent>
        {!vm.workspaceId ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>{t('sidebar.menu')}</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={t('sidebar.allWorkspaces')}
                    aria-label={t('sidebar.allWorkspaces')}
                    isActive={!globalSection}
                    onClick={returnToWorkspaces}
                    data-testid="portal-workspaces-button"
                  >
                    <Layers aria-hidden="true" />
                    <SidebarMenuLabel>{t('sidebar.allWorkspaces')}</SidebarMenuLabel>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>{t('shell.workspaces')}</SidebarGroupLabel>
              <SidebarMenu>
                {vm.items.map(item => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      tooltip={item.name}
                      aria-label={item.name}
                      onClick={() => selectWorkspace(item.id)}
                      data-testid={`sidebar-workspace-${item.id}`}
                    >
                      <FolderClosed aria-hidden="true" />
                      <SidebarMenuLabel>{item.name}</SidebarMenuLabel>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </>
        ) : (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={t('sidebar.allWorkspaces')}
                  aria-label={t('sidebar.allWorkspaces')}
                  onClick={returnToWorkspaces}
                  data-testid="portal-return-workspaces-button"
                >
                  <ArrowLeft aria-hidden="true" />
                  <SidebarMenuLabel>{t('sidebar.allWorkspaces')}</SidebarMenuLabel>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <WorkspaceSectionItem
                section="overview"
                label={t('nav.overview')}
                icon={LayoutGrid}
                active={vm.tab === 'overview'}
                onSelect={selectSection}
                testId="workspace-overview-nav"
              />

              <WorkspaceSectionGroup
                label={t('group.api')}
                icon={Waypoints}
                activeSection={vm.tab}
                sections={[
                  { section: 'collections', label: t('nav.collections'), icon: BookOpen, testId: 'workspace-collections-nav' },
                  { section: 'history', label: t('nav.history'), icon: GitCommitHorizontal, testId: 'workspace-history-nav' },
                ]}
                onSelect={selectSection}
                testId="workspace-api-nav"
              />

              <WorkspaceSectionGroup
                label={t('group.design')}
                icon={Palette}
                activeSection={vm.tab}
                sections={[
                  { section: 'design-ui', label: t('nav.uiStitchkit'), icon: LayoutGrid, testId: 'workspace-design-ui-nav', comingSoon: true },
                  { section: 'design-database', label: t('nav.databaseDbdesign'), icon: Database, testId: 'workspace-design-database-nav', comingSoon: true },
                ]}
                onSelect={selectSection}
                testId="workspace-design-nav"
              />

              <WorkspaceSectionItem
                section="projects"
                label={t('nav.project')}
                icon={FolderKanban}
                active={vm.tab === 'projects'}
                onSelect={selectSection}
                testId="workspace-projects-nav"
                comingSoon
              />
              <WorkspaceSectionItem
                section="team"
                label={t('nav.team')}
                icon={Users}
                active={vm.tab === 'team'}
                onSelect={selectSection}
                testId="workspace-team-nav"
              />
              {canManageSettings && (
                <WorkspaceSectionItem
                  section="settings"
                  label={t('nav.settings')}
                  icon={Settings}
                  active={vm.tab === 'settings'}
                  onSelect={selectSection}
                  testId="workspace-settings-nav"
                />
              )}
            </SidebarMenu>
          </SidebarGroup>
        )}
        {vm.me.data?.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>{t('group.admin')}</SidebarGroupLabel>
            <SidebarMenu>
              <WorkspaceSectionItem
                section="admin-users"
                label={t('nav.adminUsers')}
                icon={UserCog}
                active={vm.tab === 'admin-users'}
                onSelect={selectSection}
                testId="admin-users-nav"
              />
              <WorkspaceSectionItem
                section="admin-workspaces"
                label={t('nav.adminWorkspaces')}
                icon={FolderClosed}
                active={vm.tab === 'admin-workspaces'}
                onSelect={selectSection}
                testId="admin-workspaces-nav"
              />
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="gap-3 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <NotificationsMenu vm={vm} onOpenNotification={openNotification} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Popover open={accountOpen} onOpenChange={setAccountOpen}>
              <PopoverTrigger asChild>
                <SidebarMenuButton
                  tooltip={t('sidebar.accountMenu')}
                  aria-label={t('sidebar.accountMenu')}
                  aria-expanded={accountOpen}
                  isActive={globalSection}
                  className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
                  data-testid="portal-account-menu-trigger"
                >
                  <UserRound className="size-4 shrink-0" aria-hidden="true" />
                  <SidebarMenuLabel className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
                    {vm.me.data?.email}
                  </SidebarMenuLabel>
                  <ChevronDown aria-hidden="true" className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </PopoverTrigger>
              <PopoverContent side="right" align="end" className="w-64" data-testid="portal-account-menu">
                <FieldGroup className="gap-1">
                  <FieldDescription className="truncate px-2 py-1 text-xs">{vm.me.data?.email}</FieldDescription>
                  <Button
                    type="button"
                    variant={vm.tab === 'mcp-key' ? 'secondary' : 'ghost'}
                    className="min-h-10 justify-start px-2"
                    onClick={() => {
                      selectSection('mcp-key')
                      setAccountOpen(false)
                    }}
                    data-testid="mcp-keys-nav"
                  >
                    {t('nav.myMcpKeys')}
                  </Button>
                  {vm.me.data?.isAdmin && (
                    <Button
                      type="button"
                      variant={vm.tab === 'admin-mcp-keys' ? 'secondary' : 'ghost'}
                      className="min-h-10 justify-start px-2"
                      onClick={() => {
                        selectSection('admin-mcp-keys')
                        setAccountOpen(false)
                      }}
                      data-testid="admin-mcp-keys-nav"
                    >
                      {t('nav.mcpKeyAdminShort')}
                    </Button>
                  )}
                  <Separator className="my-1" />
                  <LanguageSelect className="w-full" />
                  <Separator className="my-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-10 justify-start px-2"
                    disabled={vm.logout.isPending}
                    onClick={() => vm.logout.mutate()}
                    data-testid="portal-logout-button"
                  >
                    {vm.logout.isPending ? t('auth.signingOut') : t('auth.signOut')}
                  </Button>
                  {vm.logout.error && <ErrorView error={vm.logout.error} />}
                </FieldGroup>
              </PopoverContent>
            </Popover>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

function WorkspaceSectionItem({
  section,
  label,
  icon: Icon,
  active,
  onSelect,
  testId,
  comingSoon = false,
}: {
  section: WorkspaceSection
  label: string
  icon: LucideIcon
  active: boolean
  onSelect: (section: WorkspaceSection) => void
  testId: string
  comingSoon?: boolean
}) {
  const { t } = useTranslation()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={comingSoon ? t('nav.comingSoon', { label }) : label}
        aria-label={comingSoon ? t('nav.comingSoon', { label }) : label}
        isActive={active}
        onClick={() => onSelect(section)}
        data-testid={testId}
      >
        <Icon aria-hidden="true" />
        <SidebarMenuLabel>{label}</SidebarMenuLabel>
        {comingSoon && (
          <Badge variant="secondary" className="ml-auto group-data-[collapsible=icon]:hidden">
            {t('nav.soon')}
          </Badge>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function WorkspaceSectionGroup({
  label,
  icon: Icon,
  activeSection,
  sections,
  onSelect,
  testId,
}: {
  label: string
  icon: LucideIcon
  activeSection: WorkspaceSection
  sections: Array<{
    section: WorkspaceSection
    label: string
    icon: LucideIcon
    testId: string
    comingSoon?: boolean
  }>
  onSelect: (section: WorkspaceSection) => void
  testId: string
}) {
  const { t } = useTranslation()
  const { isMobile, state } = useSidebar()
  const [expanded, setExpanded] = useState(true)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const active = sections.some(section => section.section === activeSection)
  const compact = !isMobile && state === 'collapsed'
  const submenuId = `${testId}-submenu`

  if (compact) {
    return (
      <SidebarMenuItem>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              aria-label={label}
              aria-expanded={popoverOpen}
              isActive={active}
              data-testid={`${testId}-toggle`}
            >
              <Icon aria-hidden="true" />
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-60">
            <FieldDescription className="px-2 py-1 text-xs font-medium text-foreground">
              {label}
            </FieldDescription>
            <FieldGroup className="gap-1">
              {sections.map(section => {
                return (
                  <Button
                    key={section.section}
                    type="button"
                    variant={section.section === activeSection ? 'secondary' : 'ghost'}
                    className="min-h-10 justify-start px-2"
                    aria-label={section.comingSoon ? t('nav.comingSoon', { label: section.label }) : section.label}
                    onClick={() => {
                      onSelect(section.section)
                      setPopoverOpen(false)
                    }}
                    data-testid={section.testId}
                  >
                    <SidebarMenuLabel className="flex-1 text-left">{section.label}</SidebarMenuLabel>
                    {section.comingSoon && <Badge variant="secondary">{t('nav.soon')}</Badge>}
                  </Button>
                )
              })}
            </FieldGroup>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={label}
        aria-label={label}
        aria-expanded={expanded}
        aria-controls={submenuId}
        isActive={active}
        onClick={() => setExpanded(value => !value)}
        data-testid={`${testId}-toggle`}
      >
        <Icon aria-hidden="true" />
        <SidebarMenuLabel>{label}</SidebarMenuLabel>
        <ChevronDown
          aria-hidden="true"
          className={`ml-auto size-4 transition-transform group-data-[collapsible=icon]:hidden ${expanded ? 'rotate-180' : ''}`}
        />
      </SidebarMenuButton>
      <SidebarMenuSub id={submenuId} hidden={!expanded}>
        {sections.map(section => (
          <WorkspaceSectionSubItem
            key={section.section}
            section={section.section}
            label={section.label}
            icon={section.icon}
            active={section.section === activeSection}
            onSelect={onSelect}
            testId={section.testId}
            comingSoon={section.comingSoon}
          />
        ))}
      </SidebarMenuSub>
    </SidebarMenuItem>
  )
}

function WorkspaceSectionSubItem({
  section,
  label,
  icon: Icon,
  active,
  onSelect,
  testId,
  comingSoon = false,
}: {
  section: WorkspaceSection
  label: string
  icon: LucideIcon
  active: boolean
  onSelect: (section: WorkspaceSection) => void
  testId: string
  comingSoon?: boolean
}) {
  const { t } = useTranslation()
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={active}>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 w-full cursor-pointer justify-start font-normal md:min-h-7"
          aria-label={comingSoon ? t('nav.comingSoon', { label }) : label}
          onClick={() => onSelect(section)}
          data-testid={testId}
        >
          <Icon aria-hidden="true" />
          <SidebarMenuLabel>{label}</SidebarMenuLabel>
          {comingSoon && (
            <Badge variant="secondary" className="ml-auto group-data-[collapsible=icon]:hidden">
              {t('nav.soon')}
            </Badge>
          )}
        </Button>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}
