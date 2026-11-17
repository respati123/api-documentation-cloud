import { useTranslation } from 'react-i18next'
import { MCP_ACCESS_TEXT, MCP_KEY_STATE_TEXT } from '@/features/mcp-access/constants/mcp-access-text.constants'
import type { McpKey } from '@/features/mcp-access/models/mcp-key.model'
import { KeyStateBadge } from '@/features/mcp-access/views/key-state-badge.view'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/primitives/alert-dialog'
import { Button } from '@/shared/components/primitives/button'
import { Card } from '@/shared/components/primitives/card'
import { ScrollArea } from '@/shared/components/primitives/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/primitives/table'
import { formatDate } from '@/shared/utils/format'

type Row = McpKey & { owner?: { email: string } }

export function McpKeysTable<T extends Row>({
  keys,
  showOwner = false,
  revokingId,
  onRevoke,
  testId,
}: {
  keys: T[]
  showOwner?: boolean
  revokingId: string | null
  onRevoke: (key: T) => void
  testId: string
}) {
  const { t, i18n } = useTranslation('mcp')
  const date = (value: string | null) => (value ? (formatDate(value, i18n.language) ?? '') : '')

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <ScrollArea className="w-full">
        <Table aria-label={t(MCP_ACCESS_TEXT.table.label)} data-testid={testId}>
          <TableHeader>
            <TableRow>
              {showOwner && <TableHead>{t(MCP_ACCESS_TEXT.table.owner)}</TableHead>}
              <TableHead>{t(MCP_ACCESS_TEXT.table.name)}</TableHead>
              <TableHead className="hidden sm:table-cell">{t(MCP_ACCESS_TEXT.table.key)}</TableHead>
              <TableHead className="hidden md:table-cell">{t(MCP_ACCESS_TEXT.table.created)}</TableHead>
              <TableHead className="hidden lg:table-cell">{t(MCP_ACCESS_TEXT.table.lastUsed)}</TableHead>
              <TableHead className="hidden md:table-cell">{t(MCP_ACCESS_TEXT.table.expires)}</TableHead>
              <TableHead>{t(MCP_ACCESS_TEXT.table.status)}</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">{t(MCP_ACCESS_TEXT.table.actions)}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => (
              <TableRow key={key.id} data-testid={`${testId}-row-${key.id}`}>
                {showOwner && <TableCell className="max-w-56 truncate">{key.owner?.email}</TableCell>}
                <TableCell className="max-w-56 truncate font-medium">{key.name}</TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                  {key.keySuffix ? `apm_••••${key.keySuffix}` : 'apm_••••'}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{date(key.createdAt)}</TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {key.lastUsedAt ? date(key.lastUsedAt) : t(MCP_ACCESS_TEXT.table.never)}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {key.expiresAt ? date(key.expiresAt) : t(MCP_ACCESS_TEXT.table.noExpiry)}
                </TableCell>
                <TableCell>
                  <KeyStateBadge state={key.status} label={t(MCP_KEY_STATE_TEXT[key.status])} />
                </TableCell>
                <TableCell className="text-right">
                  {key.status === 'active' && (
                    <RevokeKeyButton
                      name={key.name}
                      disabled={revokingId === key.id}
                      testId={`${testId}-revoke-${key.id}`}
                      onConfirm={() => onRevoke(key)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  )
}

function RevokeKeyButton({
  name,
  disabled,
  testId,
  onConfirm,
}: {
  name: string
  disabled: boolean
  testId: string
  onConfirm: () => void
}) {
  const { t } = useTranslation('mcp')
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" className="text-destructive" disabled={disabled} data-testid={testId} />}
      >
        {t(MCP_ACCESS_TEXT.table.revoke)}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(MCP_ACCESS_TEXT.table.revokeTitle, { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t(MCP_ACCESS_TEXT.table.revokeDetail)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t(MCP_ACCESS_TEXT.table.cancel)}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" data-testid={`${testId}-confirm`} onClick={onConfirm}>
            {t(MCP_ACCESS_TEXT.table.revokeConfirm)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
