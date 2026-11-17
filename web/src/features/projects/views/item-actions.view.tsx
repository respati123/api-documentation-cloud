import { Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import { storyStage } from '@/features/projects/models/story.model'
import type { useItemDetailViewModel } from '@/features/projects/viewmodels/use-item-detail.viewmodel'
import type { usePlanningViewModel } from '@/features/projects/viewmodels/use-planning.viewmodel'
import { StoryEditor } from '@/features/projects/views/story-parts.view'
import { Button } from '@/shared/components/primitives/button'
import { Checkbox } from '@/shared/components/primitives/checkbox'
import { Input } from '@/shared/components/primitives/input'
import { Label } from '@/shared/components/primitives/label'
import { Textarea } from '@/shared/components/primitives/textarea'

type Planning = ReturnType<typeof usePlanningViewModel>
type Detail = ReturnType<typeof useItemDetailViewModel>

// The action buttons and the edit form, shared by the epic and the story detail pages.
export function ItemActions({ vm, extras }: { vm: Detail; extras: Planning['storyExtras'] | null }) {
  const { t } = useTranslation('planning')
  const showsSomething = vm.canMoveNext || vm.canPublish || vm.canManage
  if (!showsSomething || vm.editing) return null
  return (
    <div className="grid gap-2 rounded-xl border border-border bg-card px-[18px] py-4">
      {vm.canPublish && (
        <>
          <Button variant="approve" data-testid="projects-item-publish" disabled={vm.isBusy} onClick={vm.onPublish}>
            {t(PLANNING_TEXT.item.publish)}
          </Button>
          <p className="text-xs text-muted-foreground">{t(PLANNING_TEXT.item.publishHint)}</p>
        </>
      )}
      {vm.canMoveNext && vm.next && !(vm.next === 'in_progress' && extras && (extras.stage === 'draft' || extras.stage === 'design')) && (
        <Button
          variant={vm.next === 'ready' ? 'approve' : 'default'}
          data-testid="projects-item-next"
          disabled={vm.isBusy}
          onClick={vm.onMoveNext}
        >
          {t(PLANNING_TEXT.item.next, {
            status: vm.item?.kind === 'story' ? t(PLANNING_TEXT.stage[storyStage(vm.next)]) : t(PLANNING_TEXT.status.item[vm.next]),
          })}
        </Button>
      )}
      {vm.canManage && (
        <Button
          variant="outline"
          data-testid="projects-item-edit"
          onClick={() => {
            vm.onEdit()
            extras?.startEdit()
          }}
        >
          <Pencil data-icon="inline-start" />
          {t(PLANNING_TEXT.item.edit)}
        </Button>
      )}
    </div>
  )
}

export function ItemEditForm({ vm, extras }: { vm: Detail; extras: Planning['storyExtras'] | null }) {
  const { t } = useTranslation('planning')
  const isStory = vm.item?.kind === 'story'
  return (
    <form
      className="grid gap-4 rounded-xl border border-border bg-card px-[18px] py-4"
      data-testid="projects-item-edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        vm.onSave()
        extras?.saveEdit()
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="planning-item-title">{t(PLANNING_TEXT.item.name)}</Label>
        <Input
          id="planning-item-title"
          data-testid="projects-item-edit-title"
          value={vm.title}
          onChange={(event) => vm.setTitle(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="planning-item-description">{t(PLANNING_TEXT.item.description)}</Label>
        <Textarea
          id="planning-item-description"
          data-testid="projects-item-edit-description"
          className="min-h-28"
          value={vm.description}
          onChange={(event) => vm.setDescription(event.target.value)}
        />
      </div>
      {isStory && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="planning-item-criteria">{t(PLANNING_TEXT.item.acceptance)}</Label>
            <Textarea
              id="planning-item-criteria"
              data-testid="projects-item-edit-criteria"
              className="min-h-28"
              value={vm.criteria}
              onChange={(event) => vm.setCriteria(event.target.value)}
            />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t(PLANNING_TEXT.item.participants)}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {vm.members.map((member) => (
                <Label key={member.id} className="font-normal">
                  <Checkbox
                    data-testid={`projects-item-edit-participant-${member.id}`}
                    checked={vm.selectedParticipants.includes(member.id)}
                    onChange={() => vm.toggleParticipant(member.id)}
                  />
                  {member.email}
                </Label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {extras && <StoryEditor extras={extras} />}
      <div className="flex gap-2">
        <Button type="submit" data-testid="projects-item-save" disabled={!vm.canSave}>
          {t(PLANNING_TEXT.item.save)}
        </Button>
        <Button
          type="button"
          variant="ghost"
          data-testid="projects-item-cancel"
          onClick={() => {
            vm.onCancelEdit()
            extras?.cancelEdit()
          }}
        >
          {t(PLANNING_TEXT.item.cancel)}
        </Button>
      </div>
    </form>
  )
}
