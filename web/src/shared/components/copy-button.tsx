import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'

export function CopyButton({
  value,
  label,
  copiedLabel,
  ariaLabel,
  onCopy,
  onCopyFailed,
  testId,
}: {
  value: string
  label: string
  copiedLabel: string
  ariaLabel?: string
  onCopy?: () => void
  onCopyFailed?: () => void
  testId?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      onCopy?.()
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
      onCopyFailed?.()
    }
  }

  return (
    <Button variant="outline" size="sm" aria-label={ariaLabel} data-testid={testId} onClick={copy}>
      {copied ? copiedLabel : label}
    </Button>
  )
}
