import { useTranslation } from 'react-i18next'
import { ArrowIcon } from './icons'
import { Button } from './Button'

interface PaginationProps {
  page: number
  pageCount: number
  onPage: (page: number) => void
  busy?: boolean
}

/** Précédent / « page X sur Y » / Suivant (flèches inversées en RTL). */
export function Pagination({ page, pageCount, onPage, busy }: PaginationProps) {
  const { t } = useTranslation()
  if (pageCount <= 1) return null
  return (
    <nav
      aria-label={t('admin.common.pagination')}
      className="flex items-center justify-between gap-3"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1 || busy}
        onClick={() => onPage(page - 1)}
        icon={<ArrowIcon className="size-4 rotate-180" />}
      >
        {t('admin.common.previous')}
      </Button>
      <p role="status" className="tabular text-sm text-ink-700">
        {t('admin.common.pageOf', { page, pages: pageCount })}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pageCount || busy}
        onClick={() => onPage(page + 1)}
        icon={<ArrowIcon className="size-4" />}
      >
        {t('admin.common.next')}
      </Button>
    </nav>
  )
}
