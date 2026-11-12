import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { DocumentKind, PlanningDocumentSummary, PlanningItem } from '@/features/projects/models/planning.model'
import { planningService } from '@/features/projects/services/planning.service'
import { planningKeys } from '@/features/projects/viewmodels/planning-keys'
import { readErrorMessage } from '@/shared/utils/error-message'

interface MemberOption {
  id: string
  email: string
}

// The create dialogs of the project screens: upload a document, write a BRD or PRD, and draft an epic or story.
export function usePlanningDialogsViewModel(
  workspaceId: string,
  documents: PlanningDocumentSummary[],
  epics: PlanningItem[],
  members: MemberOption[],
  onCreatedDocument: () => void,
) {
  const { t } = useTranslation('planning')
  const token = useAuthSessionStore((state) => state.token)
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: planningKeys.all(workspaceId) })
  const failure = (error: unknown) => (error ? readErrorMessage(error, t(PLANNING_TEXT.error)) : null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadKind, setUploadKind] = useState<DocumentKind>('brd')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadSourceId, setUploadSourceId] = useState('')
  const upload = useMutation({
    mutationFn: () =>
      planningService.upload(token, workspaceId, {
        kind: uploadKind,
        title: uploadTitle.trim(),
        sourceDocumentId: uploadKind === 'prd' ? uploadSourceId : undefined,
        file: uploadFile as File,
      }),
    onSuccess: async () => {
      setUploadOpen(false)
      setUploadTitle('')
      setUploadFile(null)
      await refresh()
      onCreatedDocument()
    },
  })

  const [writeOpen, setWriteOpen] = useState(false)
  const [writeKind, setWriteKind] = useState<DocumentKind>('brd')
  const [writeSourceId, setWriteSourceId] = useState('')
  const [writeTitle, setWriteTitle] = useState('')
  const [writeContent, setWriteContent] = useState('')
  const write = useMutation({
    mutationFn: () =>
      planningService.createDocument(token, workspaceId, {
        kind: writeKind,
        title: writeTitle.trim(),
        content: writeContent,
        sourceDocumentId: writeKind === 'prd' ? writeSourceId : undefined,
      }),
    onSuccess: async () => {
      setWriteOpen(false)
      setWriteTitle('')
      setWriteContent('')
      await refresh()
      onCreatedDocument()
    },
  })

  const [itemOpen, setItemOpen] = useState(false)
  const [itemParent, setItemParent] = useState<PlanningItem | null>(null)
  const [itemSourceId, setItemSourceId] = useState('')
  const [itemTitle, setItemTitle] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemCriteria, setItemCriteria] = useState('')
  const [itemSection, setItemSection] = useState('')
  const [itemParticipants, setItemParticipants] = useState<string[]>([])
  const createItem = useMutation({
    mutationFn: () =>
      planningService.createItem(token, workspaceId, {
        kind: itemParent ? 'story' : 'epic',
        parentId: itemParent?.id,
        title: itemTitle.trim(),
        description: itemDescription.trim(),
        acceptanceCriteria: itemCriteria.trim(),
        sourceDocumentId: itemParent?.sourceDocumentId ?? itemSourceId,
        sourceSection: itemSection.trim() || undefined,
        participantIds: itemParent ? itemParticipants : [],
      }),
    onSuccess: async () => {
      setItemOpen(false)
      await refresh()
    },
  })

  const brds = documents.filter((document) => document.kind === 'brd')
  const approvedPrds = documents.filter((document) => document.kind === 'prd' && document.status === 'approved')

  return {
    upload: {
      open: uploadOpen,
      kind: uploadKind,
      setKind: setUploadKind,
      title: uploadTitle,
      setTitle: setUploadTitle,
      fileName: uploadFile?.name ?? '',
      setFile: setUploadFile,
      sourceId: uploadSourceId,
      setSourceId: setUploadSourceId,
      sources: brds,
      canSubmit: Boolean(uploadFile && uploadTitle.trim() && (uploadKind === 'brd' || uploadSourceId)) && !upload.isPending,
      isSubmitting: upload.isPending,
      error: failure(upload.error),
      onOpen: (kind: DocumentKind = 'brd') => {
        upload.reset()
        setUploadKind(kind)
        setUploadSourceId(brds[0]?.id ?? '')
        setUploadOpen(true)
      },
      onClose: () => setUploadOpen(false),
      onSubmit: () => upload.mutate(),
    },
    write: {
      open: writeOpen,
      kind: writeKind,
      sourceId: writeSourceId,
      setSourceId: setWriteSourceId,
      sources: brds,
      title: writeTitle,
      setTitle: setWriteTitle,
      content: writeContent,
      setContent: setWriteContent,
      canSubmit: Boolean(writeTitle.trim() && writeContent.trim() && (writeKind === 'brd' || writeSourceId)) && !write.isPending,
      isSubmitting: write.isPending,
      error: failure(write.error),
      canWritePrd: brds.length > 0,
      onOpen: (kind: DocumentKind = 'brd') => {
        write.reset()
        setWriteKind(kind)
        setWriteSourceId(brds[0]?.id ?? '')
        setWriteOpen(true)
      },
      onClose: () => setWriteOpen(false),
      onSubmit: () => write.mutate(),
    },
    item: {
      open: itemOpen,
      parentTitle: itemParent?.title ?? null,
      sourceId: itemSourceId,
      setSourceId: setItemSourceId,
      sources: approvedPrds,
      title: itemTitle,
      setTitle: setItemTitle,
      description: itemDescription,
      setDescription: setItemDescription,
      criteria: itemCriteria,
      setCriteria: setItemCriteria,
      section: itemSection,
      setSection: setItemSection,
      members,
      participants: itemParticipants,
      toggleParticipant: (id: string) =>
        setItemParticipants((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id])),
      canSubmit: Boolean(itemTitle.trim() && (itemParent || itemSourceId)) && !createItem.isPending,
      isSubmitting: createItem.isPending,
      error: failure(createItem.error),
      canCreateEpic: approvedPrds.length > 0,
      onOpen: (parentId?: string) => {
        createItem.reset()
        setItemParent(epics.find((epic) => epic.id === parentId) ?? null)
        setItemSourceId(approvedPrds[0]?.id ?? '')
        setItemTitle('')
        setItemDescription('')
        setItemCriteria('')
        setItemSection('')
        setItemParticipants([])
        setItemOpen(true)
      },
      onClose: () => setItemOpen(false),
      onSubmit: () => createItem.mutate(),
    },
  }
}
