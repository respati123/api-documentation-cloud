import type { AppName } from '@/features/app-integrations/models/app-integrations.model'
import { useDesignAppViewModel } from '@/features/app-integrations/viewmodels/use-design-app.viewmodel'
import { DesignAppView } from '@/features/app-integrations/views/design-app.view'

export function DesignAppPage({ workspaceId, app }: { workspaceId: string; app: AppName }) {
  const vm = useDesignAppViewModel(workspaceId, app)
  return <DesignAppView app={app} vm={vm} />
}
