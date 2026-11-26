import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, MoreHorizontal, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

// One table for every list in the portal. Rows are paged on the client; a server cursor adds a "Load more" button.
export interface DataColumn<T> {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
}

export interface DataRowAction<T> {
  id: string
  label: string
  destructive?: boolean
  disabled?: boolean
  onSelect: (row: T) => void
}

export interface DataFilterTab {
  value: string
  label: string
}

export interface DataTableProps<T> {
  rows: T[]
  columns: DataColumn<T>[]
  getRowId: (row: T) => string
  getRowTestId?: (row: T) => string
  testId?: string
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  filterTabs?: DataFilterTab[]
  filterValue?: string
  onFilterChange?: (value: string) => void
  search?: { value: string; onChange: (value: string) => void; label: string; placeholder?: string }
  selectable?: boolean
  selectedIds?: string[]
  onSelectedIdsChange?: (ids: string[]) => void
  rowActions?: (row: T) => DataRowAction<T>[]
  pageSize?: number
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  state?: 'loading' | 'error' | 'empty' | 'ready'
  errorNode?: ReactNode
  emptyNode?: ReactNode
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  getRowTestId,
  testId,
  title,
  description,
  actions,
  filterTabs,
  filterValue,
  onFilterChange,
  search,
  selectable = false,
  selectedIds = [],
  onSelectedIdsChange,
  rowActions,
  pageSize = 10,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  state = 'ready',
  errorNode,
  emptyNode,
}: DataTableProps<T>) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * pageSize
  const pageRows = rows.slice(start, start + pageSize)
  const pageIds = pageRows.map(getRowId)
  const allOnPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))
  const someSelected = pageIds.some(id => selectedIds.includes(id))

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const windowPages = useMemo(() => {
    const first = Math.max(1, Math.min(currentPage - 2, pageCount - 4))
    const last = Math.min(pageCount, first + 4)
    return Array.from({ length: last - first + 1 }, (_, index) => first + index)
  }, [currentPage, pageCount])

  const toggleOne = (id: string) =>
    onSelectedIdsChange?.(selectedIds.includes(id) ? selectedIds.filter(item => item !== id) : [...selectedIds, id])
  const toggleAllOnPage = () => {
    if (!onSelectedIdsChange) return
    const rest = selectedIds.filter(id => !pageIds.includes(id))
    onSelectedIdsChange(allOnPageSelected ? rest : [...rest, ...pageIds])
  }

  const shownFrom = rows.length ? start + 1 : 0
  const shownTo = Math.min(start + pageSize, rows.length)
  const hasToolbar = Boolean(filterTabs || search || actions)
  const showActions = Boolean(rowActions)

  const renderSearch = () =>
    search && (
      <div className="relative w-full min-w-48 max-w-64">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label={search.label}
          placeholder={search.placeholder ?? t('table.searchPlaceholder')}
          autoComplete="off"
          className="h-9 pl-9"
          value={search.value}
          onChange={event => search.onChange(event.target.value)}
          data-testid={testId ? `${testId}-search` : undefined}
        />
      </div>
    )

  return (
    <Card className="gap-4 rounded-lg py-0 shadow-none" data-testid={testId}>
      {(title || description || hasToolbar) && (
        <CardHeader className="gap-3 px-4 pt-4">
          {/* Row 1: title on the left, actions and search on the right. Without filter tabs the search stays in this row. */}
          <div className="flex min-w-0 flex-row flex-wrap items-center justify-between gap-3">
            {(title || description) && (
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {title && <CardTitle className="text-base">{title}</CardTitle>}
                {description && <CardDescription>{description}</CardDescription>}
              </div>
            )}
            <div className="flex min-w-0 flex-row flex-wrap items-center justify-end gap-2">
              {actions}
              {search && !filterTabs && renderSearch()}
            </div>
          </div>
          {/* Row 2: filter tabs on the left, search on the right. */}
          {filterTabs && (
            <div className="flex min-w-0 flex-row flex-wrap items-center justify-between gap-3">
              <Tabs value={filterValue} onValueChange={onFilterChange}>
                <TabsList aria-label={title ? String(title) : undefined}>
                  {filterTabs.map(tab => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {search && renderSearch()}
            </div>
          )}
        </CardHeader>
      )}
      <CardContent className="space-y-0 px-0 pb-0">
        {state === 'loading' ? (
          <div className="space-y-2 px-4 pb-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : state === 'error' ? (
          <div className="px-4 pb-4">{errorNode}</div>
        ) : rows.length === 0 ? (
          <div className="px-4 pb-4">{emptyNode}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {selectable && (
                  <TableHead className="w-10 pl-4">
                    <Checkbox
                      aria-label={t('table.selectAll')}
                      checked={allOnPageSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleAllOnPage}
                      data-testid={testId ? `${testId}-select-all` : undefined}
                    />
                  </TableHead>
                )}
                {columns.map(column => (
                  <TableHead key={column.id} className={column.className}>
                    {column.header}
                  </TableHead>
                ))}
                {showActions && <TableHead className="w-12 pr-4 text-right" aria-label={t('table.actions')} />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map(row => {
                const id = getRowId(row)
                const selected = selectedIds.includes(id)
                return (
                  <TableRow key={id} data-state={selected ? 'selected' : undefined} data-testid={getRowTestId?.(row)}>
                    {selectable && (
                      <TableCell className="pl-4">
                        <Checkbox
                          aria-label={t('table.selectRow')}
                          checked={selected}
                          onCheckedChange={() => toggleOne(id)}
                        />
                      </TableCell>
                    )}
                    {columns.map(column => (
                      <TableCell key={column.id} className={column.className}>
                        {column.cell(row)}
                      </TableCell>
                    ))}
                    {showActions && (
                      <TableCell className="pr-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 cursor-pointer" aria-label={t('table.moreActions')} data-testid={testId ? `${testId}-row-actions` : undefined}>
                              <MoreHorizontal aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {rowActions!(row).map(action => (
                              <DropdownMenuItem
                                key={action.id}
                                variant={action.destructive ? 'destructive' : 'default'}
                                disabled={action.disabled}
                                onSelect={() => action.onSelect(row)}
                                data-testid={`${testId ?? 'table'}-action-${action.id}`}
                              >
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        {state === 'ready' && rows.length > 0 && (
          <div className="flex flex-row flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
            <p className="text-sm text-muted-foreground" data-testid={testId ? `${testId}-summary` : undefined}>
              {t('table.showing', { from: shownFrom, to: shownTo, total: rows.length })}
            </p>
            <nav aria-label={t('table.pagination')} className="flex flex-row items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 cursor-pointer"
                aria-label={t('table.previousPage')}
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              {windowPages.map(number => (
                <Button
                  key={number}
                  variant={number === currentPage ? 'outline' : 'ghost'}
                  size="icon"
                  className="size-8 cursor-pointer"
                  aria-current={number === currentPage ? 'page' : undefined}
                  aria-label={t('table.pageNumber', { page: number })}
                  onClick={() => setPage(number)}
                >
                  {number}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="icon"
                className="size-8 cursor-pointer"
                aria-label={t('table.nextPage')}
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
            {hasMore && onLoadMore && (
              <Button variant="outline" className="cursor-pointer" disabled={loadingMore} onClick={onLoadMore} data-testid={testId ? `${testId}-load-more` : undefined}>
                {loadingMore ? t('common.loadingEllipsis') : t('table.loadMore')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
