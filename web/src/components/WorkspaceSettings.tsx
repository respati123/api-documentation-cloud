import { FormEvent, useState } from 'react'
import type { CloudWorkspaceRef } from '../types'

type Props = {
  workspace: CloudWorkspaceRef
  onRename: (name: string) => void
  onDelete: (confirmName: string) => void
}

export function WorkspaceSettings({ workspace, onRename, onDelete }: Props) {
  const [name, setName] = useState(workspace.name)
  const [confirmName, setConfirmName] = useState('')
  const trimmed = name.trim()
  const canRename = trimmed.length > 0 && trimmed !== workspace.name

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canRename) onRename(trimmed)
  }

  function submitDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (confirmName === workspace.name) onDelete(confirmName)
  }

  return <div className="workspace-settings">
    <section className="cloud-surface team-section">
      <div className="surface-heading"><div><h2>General</h2><p>The name shown to everyone with access.</p></div></div>
      <form className="settings-body" onSubmit={submitRename}>
        <label className="cloud-field"><span>Workspace name</span><input maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div><button type="submit" className="cloud-button cloud-button-primary" disabled={!canRename}>Save name</button></div>
      </form>
    </section>
    <section className="cloud-surface team-section danger-zone">
      <div className="surface-heading"><div><h2>Delete workspace</h2><p>Members lose access, and the full commit history is removed. This cannot be undone.</p></div></div>
      <form className="settings-body" onSubmit={submitDelete}>
        <label className="cloud-field"><span>Type <strong>{workspace.name}</strong> to confirm</span><input autoComplete="off" value={confirmName} onChange={(event) => setConfirmName(event.target.value)} /></label>
        <div><button type="submit" className="cloud-button cloud-button-danger" disabled={confirmName !== workspace.name}>Delete workspace</button></div>
      </form>
    </section>
  </div>
}
