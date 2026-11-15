import type { FormEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { usePlanningDialogsViewModel } from '@/features/projects/viewmodels/use-planning-dialogs.viewmodel'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Checkbox } from '@/shared/components/primitives/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/primitives/dialog'
import { Input } from '@/shared/components/primitives/input'
import { Label } from '@/shared/components/primitives/label'
import { Textarea } from '@/shared/components/primitives/textarea'
import { SelectField } from '@/shared/components/select-field'

type Dialogs = ReturnType<typeof usePlanningDialogsViewModel>

function DialogForm({
  open,
  onClose,
  onSubmit,
  title,
  detail,
  error,
  testId,
  wide,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  onSubmit: () => void
  title: string
  detail: string
  error: string | null
  testId: string
  wide?: boolean
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid={testId} className={wide ? 'max-h-[90dvh] overflow-y-auto sm:max-w-2xl' : 'sm:max-w-lg'}>
        <form
          className="grid gap-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{detail}</DialogDescription>
          </DialogHeader>
          {children}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>{footer}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PlanningDialogsView({ dialogs }: { dialogs: Dialogs }) {
  const { t } = useTranslation('planning')
  const { upload, write, item } = dialogs

  return (
    <>
      <DialogForm
        open={upload.open}
        onClose={upload.onClose}
        onSubmit={upload.onSubmit}
        title={t(PLANNING_TEXT.upload.title)}
        detail={t(PLANNING_TEXT.upload.detail)}
        error={upload.error}
        testId="planning-upload-dialog"
        footer={
          <>
            <Button type="button" variant="outline" data-testid="planning-upload-cancel" onClick={upload.onClose}>
              {t(PLANNING_TEXT.upload.cancel)}
            </Button>
            <Button type="submit" data-testid="planning-upload-submit" disabled={!upload.canSubmit}>
              {upload.isSubmitting ? t(PLANNING_TEXT.upload.submitting) : t(PLANNING_TEXT.upload.submit)}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <div className="grid gap-1.5">
            <Label htmlFor="planning-upload-kind">{t(PLANNING_TEXT.upload.kind)}</Label>
            <SelectField
              id="planning-upload-kind"
              label={t(PLANNING_TEXT.upload.kind)}
              testId="planning-upload-kind"
              value={upload.kind}
              onValueChange={(value) => upload.setKind(value === 'prd' ? 'prd' : 'brd')}
              options={[
                { value: 'brd', label: t(PLANNING_TEXT.kind.brd) },
                { value: 'prd', label: t(PLANNING_TEXT.kind.prd) },
              ]}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="planning-upload-title">{t(PLANNING_TEXT.upload.name)}</Label>
            <Input
              id="planning-upload-title"
              data-testid="planning-upload-title"
              value={upload.title}
              onChange={(event) => upload.setTitle(event.target.value)}
            />
          </div>
        </div>
        {upload.kind === 'prd' && (
          <div className="grid gap-1.5">
            <Label htmlFor="planning-upload-source">{t(PLANNING_TEXT.upload.source)}</Label>
            <SelectField
              id="planning-upload-source"
              label={t(PLANNING_TEXT.upload.source)}
              testId="planning-upload-source"
              value={upload.sourceId}
              onValueChange={upload.setSourceId}
              options={[
                { value: '', label: t(PLANNING_TEXT.upload.chooseSource) },
                ...upload.sources.map((source) => ({
                  value: source.id,
                  label: source.title,
                  hint: t(PLANNING_TEXT.documents.version, { version: source.currentVersion }),
                })),
              ]}
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="planning-upload-file">{t(PLANNING_TEXT.upload.file)}</Label>
          <Input
            id="planning-upload-file"
            type="file"
            accept=".pdf,.docx,.md,.txt"
            data-testid="planning-upload-file"
            onChange={(event) => upload.setFile(event.target.files?.[0] ?? null)}
          />
        </div>
      </DialogForm>

      <DialogForm
        open={write.open}
        onClose={write.onClose}
        onSubmit={write.onSubmit}
        title={write.kind === 'prd' ? t(PLANNING_TEXT.write.prdTitle) : t(PLANNING_TEXT.write.title)}
        detail={write.kind === 'prd' ? t(PLANNING_TEXT.write.prdDetail) : t(PLANNING_TEXT.write.detail)}
        error={write.error}
        testId="planning-write-dialog"
        wide
        footer={
          <>
            <Button type="button" variant="outline" data-testid="planning-write-cancel" onClick={write.onClose}>
              {t(PLANNING_TEXT.write.cancel)}
            </Button>
            <Button type="submit" data-testid="planning-write-submit" disabled={!write.canSubmit}>
              {write.isSubmitting
                ? t(PLANNING_TEXT.write.submitting)
                : write.kind === 'prd'
                  ? t(PLANNING_TEXT.write.prdSubmit)
                  : t(PLANNING_TEXT.write.submit)}
            </Button>
          </>
        }
      >
        {write.kind === 'prd' && (
          <div className="grid gap-1.5">
            <Label htmlFor="planning-write-source">{t(PLANNING_TEXT.upload.source)}</Label>
            <SelectField
              id="planning-write-source"
              label={t(PLANNING_TEXT.upload.source)}
              testId="planning-write-source"
              value={write.sourceId}
              onValueChange={write.setSourceId}
              options={[
                { value: '', label: t(PLANNING_TEXT.upload.chooseSource) },
                ...write.sources.map((source) => ({
                  value: source.id,
                  label: source.title,
                  hint: t(PLANNING_TEXT.documents.version, { version: source.currentVersion }),
                })),
              ]}
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="planning-write-title">{t(PLANNING_TEXT.write.name)}</Label>
          <Input
            id="planning-write-title"
            data-testid="planning-write-title"
            value={write.title}
            onChange={(event) => write.setTitle(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="planning-write-content">{t(PLANNING_TEXT.write.content)}</Label>
          <Textarea
            id="planning-write-content"
            data-testid="planning-write-content"
            className="min-h-72 font-mono text-xs leading-relaxed"
            value={write.content}
            onChange={(event) => write.setContent(event.target.value)}
          />
        </div>
      </DialogForm>

      <DialogForm
        open={item.open}
        onClose={item.onClose}
        onSubmit={item.onSubmit}
        title={
          item.parentTitle ? t(PLANNING_TEXT.itemDialog.storyTitle, { epic: item.parentTitle }) : t(PLANNING_TEXT.itemDialog.epicTitle)
        }
        detail={t(PLANNING_TEXT.itemDialog.detail)}
        error={item.error}
        testId="planning-item-dialog"
        wide
        footer={
          <>
            <Button type="button" variant="outline" data-testid="planning-item-cancel" onClick={item.onClose}>
              {t(PLANNING_TEXT.itemDialog.cancel)}
            </Button>
            <Button type="submit" data-testid="planning-item-submit" disabled={!item.canSubmit}>
              {item.isSubmitting ? t(PLANNING_TEXT.itemDialog.submitting) : t(PLANNING_TEXT.itemDialog.submit)}
            </Button>
          </>
        }
      >
        {!item.parentTitle && (
          <div className="grid gap-1.5">
            <Label htmlFor="planning-item-source">{t(PLANNING_TEXT.itemDialog.prd)}</Label>
            <SelectField
              id="planning-item-source"
              label={t(PLANNING_TEXT.itemDialog.prd)}
              testId="planning-item-source"
              value={item.sourceId}
              onValueChange={item.setSourceId}
              options={[
                { value: '', label: t(PLANNING_TEXT.itemDialog.choosePrd) },
                ...item.sources.map((source) => ({
                  value: source.id,
                  label: source.title,
                  hint: t(PLANNING_TEXT.documents.version, { version: source.currentVersion }),
                })),
              ]}
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="planning-item-title">{t(PLANNING_TEXT.itemDialog.name)}</Label>
          <Input
            id="planning-item-title"
            data-testid="planning-item-title"
            value={item.title}
            onChange={(event) => item.setTitle(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="planning-item-description">{t(PLANNING_TEXT.itemDialog.description)}</Label>
          <Textarea
            id="planning-item-description"
            data-testid="planning-item-description"
            className={item.parentTitle ? 'min-h-24' : 'min-h-56 font-mono text-[13px]'}
            aria-describedby={item.parentTitle ? undefined : 'planning-item-description-hint'}
            value={item.description}
            onChange={(event) => item.setDescription(event.target.value)}
          />
          {!item.parentTitle && (
            <p id="planning-item-description-hint" className="text-xs text-muted-foreground">
              {t(PLANNING_TEXT.itemDialog.epicHint)}
            </p>
          )}
        </div>
        {item.parentTitle && (
          <div className="grid gap-1.5">
            <Label htmlFor="planning-item-criteria">{t(PLANNING_TEXT.itemDialog.acceptance)}</Label>
            <Textarea
              id="planning-item-criteria"
              data-testid="planning-item-criteria"
              className="min-h-24"
              value={item.criteria}
              onChange={(event) => item.setCriteria(event.target.value)}
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="planning-item-section">{t(PLANNING_TEXT.itemDialog.section)}</Label>
          <Input
            id="planning-item-section"
            data-testid="planning-item-section"
            value={item.section}
            onChange={(event) => item.setSection(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t(PLANNING_TEXT.itemDialog.sectionHint)}</p>
        </div>
        {item.parentTitle && item.members.length > 0 && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t(PLANNING_TEXT.itemDialog.participants)}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {item.members.map((member) => (
                <Label key={member.id} className="font-normal">
                  <Checkbox
                    data-testid={`planning-item-participant-${member.id}`}
                    checked={item.participants.includes(member.id)}
                    onChange={() => item.toggleParticipant(member.id)}
                  />
                  {member.email}
                </Label>
              ))}
            </div>
          </fieldset>
        )}
      </DialogForm>
    </>
  )
}
