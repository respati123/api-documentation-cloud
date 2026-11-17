import { Separator } from '@/shared/components/primitives/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/primitives/table'
import { cn } from '@/shared/utils/cn'
import type { Inline, MarkdownBlock, TableAlign } from '@/shared/utils/markdown'

const alignClass: Record<TableAlign, string> = { left: 'text-left', center: 'text-center', right: 'text-right' }

function InlineText({ nodes }: { nodes: Inline[] }) {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'strong':
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: inline runs have no id and keep their order
          <strong key={index} className="font-semibold text-foreground">
            <InlineText nodes={node.children} />
          </strong>
        )
      case 'em':
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: inline runs have no id and keep their order
          <em key={index}>
            <InlineText nodes={node.children} />
          </em>
        )
      case 'code':
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: inline runs have no id and keep their order
          <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
            {node.text}
          </code>
        )
      case 'link':
        // Links from a document are shown with their address instead of being opened from here.
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: inline runs have no id and keep their order
          <span key={index} className="underline decoration-border underline-offset-2">
            <InlineText nodes={node.label} />
            <span className="text-muted-foreground"> ({node.href})</span>
          </span>
        )
      default:
        return node.text
    }
  })
}

function Lines({ lines }: { lines: Inline[][] }) {
  return lines.map((line, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: lines have no id and keep their order
    <span key={index}>
      {index > 0 && <br />}
      <InlineText nodes={line} />
    </span>
  ))
}

function Block({ block }: { block: MarkdownBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <h3
          id={block.id}
          className={cn(
            'scroll-mt-4 font-heading font-semibold tracking-tight text-balance',
            block.level === 2 && 'mt-5 text-lg first:mt-0',
            block.level === 3 && 'mt-2 text-[15px]',
            block.level === 4 && 'mt-1 text-sm',
          )}
        >
          <InlineText nodes={block.content} />
        </h3>
      )
    case 'paragraph':
      return (
        <p className="text-sm leading-relaxed text-pretty">
          <Lines lines={block.lines} />
        </p>
      )
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul'
      return (
        <ListTag
          start={block.ordered && block.start !== 1 ? block.start : undefined}
          className={cn(
            'grid gap-1.5 pl-5 text-sm leading-relaxed marker:text-muted-foreground',
            block.ordered ? 'list-decimal' : 'list-disc',
          )}
        >
          {block.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: list items have no id and keep their order
            <li key={index} className="pl-1">
              <InlineText nodes={item.content} />
              {item.children.length > 0 && (
                <div className="mt-1.5 grid gap-1.5">
                  <Blocks blocks={item.children} />
                </div>
              )}
            </li>
          ))}
        </ListTag>
      )
    }
    case 'table':
      return (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table className="text-[13px]">
            {block.hasHeader && (
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  {block.header.map((cell, index) => (
                    <TableHead
                      // biome-ignore lint/suspicious/noArrayIndexKey: columns have no id and keep their order
                      key={index}
                      className={cn(
                        'h-auto px-3 py-2 align-bottom whitespace-normal text-foreground',
                        alignClass[block.align[index] ?? 'left'],
                      )}
                    >
                      <InlineText nodes={cell} />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
            )}
            <TableBody>
              {block.rows.map((row, rowIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id and keep their order
                <TableRow key={rowIndex} className="hover:bg-transparent">
                  {row.map((cell, index) => (
                    <TableCell
                      // biome-ignore lint/suspicious/noArrayIndexKey: columns have no id and keep their order
                      key={index}
                      className={cn(
                        'px-3 py-2 align-top leading-relaxed whitespace-normal tabular-nums',
                        alignClass[block.align[index] ?? 'left'],
                        // A table without a header is a list of labels and values.
                        !block.hasHeader && index === 0 && 'w-[34%] font-medium text-muted-foreground',
                      )}
                    >
                      <InlineText nodes={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )
    case 'quote':
      return (
        <blockquote className="grid gap-2 border-l border-border pl-3 text-muted-foreground">
          <Blocks blocks={block.children} />
        </blockquote>
      )
    case 'code':
      return <pre className="m-0 overflow-x-auto rounded-lg bg-muted/60 px-3.5 py-3 font-mono text-xs leading-relaxed">{block.text}</pre>
    case 'rule':
      return <Separator className="my-1" />
  }
}

function Blocks({ blocks }: { blocks: MarkdownBlock[] }) {
  return blocks.map((block, index) => <Block key={block.type === 'heading' ? block.id : index} block={block} />)
}

export function MarkdownContent({ blocks, className }: { blocks: MarkdownBlock[]; className?: string }) {
  return (
    <div className={cn('grid gap-3', className)}>
      <Blocks blocks={blocks} />
    </div>
  )
}
