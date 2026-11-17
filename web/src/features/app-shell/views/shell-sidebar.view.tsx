import {
  BookOpen,
  ChevronRight,
  Database,
  FolderKanban,
  GitCommitHorizontal,
  Home,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Palette,
  Settings,
  Users,
  Waypoints,
} from 'lucide-react'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { SHELL_TEXT } from '@/features/app-shell/constants/app-shell-text.constants'
import type { AppRoute } from '@/features/app-shell/models/route.model'
import type { SidebarItem, SidebarItemId } from '@/features/app-shell/models/sidebar.model'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/primitives/collapsible'
import { appVersion } from '@/shared/config/app-version'
import { cn } from '@/shared/utils/cn'

const ITEM_ICON: Record<SidebarItemId, typeof Home> = {
  home: Home,
  workspaces: Layers,
  overview: LayoutGrid,
  api: Waypoints,
  collections: BookOpen,
  history: GitCommitHorizontal,
  design: Palette,
  'design-ui': LayoutTemplate,
  'design-database': Database,
  projects: FolderKanban,
  team: Users,
  settings: Settings,
}

export interface ShellSidebarViewProps {
  items: SidebarItem[]
  inWorkspace: boolean
  expandedGroups: Record<string, boolean>
  onGroupExpandedChange: (group: string, expanded: boolean) => void
  onNavigate: (route: AppRoute) => void
}

export function ShellSidebarView({ items, inWorkspace, expandedGroups, onGroupExpandedChange, onNavigate }: ShellSidebarViewProps) {
  const { t } = useTranslation('shell')
  return (
    <nav
      aria-label={t(inWorkspace ? SHELL_TEXT.nav.workspaceMenuLabel : SHELL_TEXT.nav.mainLabel)}
      data-testid="cloud-sidebar"
      className="flex min-h-0 flex-1 flex-col gap-1 p-3"
    >
      {items.map((item) =>
        item.children ? (
          <Collapsible key={item.id} open={expandedGroups[item.id] ?? true} onOpenChange={(open) => onGroupExpandedChange(item.id, open)}>
            <CollapsibleTrigger
              render={
                <SidebarButton
                  item={item}
                  highlight={item.active && !(expandedGroups[item.id] ?? true)}
                  className="aria-expanded:bg-transparent aria-expanded:hover:bg-muted"
                  aria-label={t(item.id === 'design' ? SHELL_TEXT.nav.toggleDesign : SHELL_TEXT.nav.toggleApi)}
                  testId={`cloud-nav-${item.id}-toggle`}
                />
              }
            >
              <SidebarLabel item={item} />
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  'ml-auto size-3.5 text-muted-foreground transition-transform duration-150',
                  (expandedGroups[item.id] ?? true) && 'rotate-90',
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent
              className={cn(
                'h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 ease-out motion-reduce:transition-none',
                'data-[ending-style]:h-0 data-[starting-style]:h-0',
              )}
            >
              <div className="ml-4 grid gap-1 border-l border-border py-1 pl-2" data-testid={`cloud-nav-${item.id}-children`}>
                {item.children.map((child) => (
                  <SidebarButton
                    key={child.id}
                    item={child}
                    highlight={child.active}
                    testId={`cloud-nav-${child.id}`}
                    onClick={() => onNavigate(child.route)}
                  >
                    <SidebarLabel item={child} />
                  </SidebarButton>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <SidebarButton
            key={item.id}
            item={item}
            highlight={item.active}
            testId={`cloud-nav-${item.id}`}
            onClick={() => onNavigate(item.route)}
          >
            <SidebarLabel item={item} />
            {item.count !== undefined && (
              <Badge variant="secondary" className="ml-auto">
                {item.count}
              </Badge>
            )}
          </SidebarButton>
        ),
      )}
      <p data-testid="cloud-app-version" className="mt-auto px-2 pt-3 text-xs text-muted-foreground">
        {t(SHELL_TEXT.nav.version, { version: appVersion })}
      </p>
    </nav>
  )
}

function SidebarLabel({ item }: { item: SidebarItem }) {
  const { t } = useTranslation('shell')
  const Icon = ITEM_ICON[item.id]
  return (
    <>
      <Icon data-icon="inline-start" aria-hidden="true" />
      <span className="truncate">{t(item.label)}</span>
    </>
  )
}

function SidebarButton({
  item,
  highlight,
  testId,
  className,
  ...props
}: ComponentProps<typeof Button> & { item: SidebarItem; highlight: boolean; testId: string }) {
  return (
    <Button
      variant="ghost"
      aria-current={highlight && !item.children ? 'page' : undefined}
      data-testid={testId}
      data-active={item.active || undefined}
      className={cn(
        'h-8 w-full justify-start gap-2 px-2 font-normal',
        highlight && 'bg-primary/10 font-medium text-primary hover:bg-primary/15',
        className,
      )}
      {...props}
    />
  )
}
