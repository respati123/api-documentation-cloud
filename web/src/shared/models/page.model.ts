// One page of a cursor-paged list. nextCursor is null on the last page.
export interface Page<T> {
  items: T[]
  nextCursor: string | null
}
