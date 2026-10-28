import { useCreateWorkspaceViewModel } from '../viewmodels/use-create-workspace.viewmodel'
import { CreateWorkspaceDialogView } from '../views/create-workspace-dialog.view'

export function CreateWorkspaceDialog({ onCreated }: { onCreated: (workspace: { id: string; name: string }) => void }) {
  const vm = useCreateWorkspaceViewModel(onCreated)
  return (
    <CreateWorkspaceDialogView
      isOpen={vm.isOpen}
      isBusy={vm.isBusy}
      errorMessage={vm.errorMessage}
      onClose={vm.handleClose}
      onSubmit={vm.handleSubmit}
    />
  )
}
