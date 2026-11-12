import { AppError } from '@/lib/errors/app-error'

export async function extractDocumentFile(file: File): Promise<{ content: string; fileName: string; mimeType: string; fileBytes: Uint8Array }> {
  if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new AppError('PLANNING_INPUT_INVALID')
  const name = file.name.slice(0, 255)
  const lower = name.toLowerCase()
  const bytes = new Uint8Array(await file.arrayBuffer())
  let content: string
  let mimeType: string
  try {
    if (lower.endsWith('.pdf')) {
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('Invalid PDF')
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(bytes) })
      try { content = (await parser.getText()).text } finally { await parser.destroy() }
      mimeType = 'application/pdf'
    } else if (lower.endsWith('.docx')) {
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Invalid DOCX')
      const mammoth = await import('mammoth')
      content = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    } else if (lower.endsWith('.md') || lower.endsWith('.txt')) {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      mimeType = lower.endsWith('.md') ? 'text/markdown' : 'text/plain'
    } else throw new Error('Unsupported format')
  } catch {
    throw new AppError('PLANNING_INPUT_INVALID')
  }
  if (!content.trim() || content.length > 500_000) throw new AppError('PLANNING_INPUT_INVALID')
  return { content, fileName: name, mimeType, fileBytes: bytes }
}
