import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { PAGINATION_TEXT } from '@/shared/constants/pagination-text.constants'

export function LoadMoreButton({
  hasMore,
  isLoading,
  onLoadMore,
  testId,
}: {
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  testId: string
}) {
  const { t } = useTranslation()
  if (!hasMore) return null
  return (
    <div className="flex justify-center pt-2">
      <Button variant="outline" size="sm" data-testid={testId} disabled={isLoading} onClick={onLoadMore}>
        {isLoading ? t(PAGINATION_TEXT.loading) : t(PAGINATION_TEXT.loadMore)}
      </Button>
    </div>
  )
}
