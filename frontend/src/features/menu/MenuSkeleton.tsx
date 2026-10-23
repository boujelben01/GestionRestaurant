import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui'

export function ArticleCardSkeleton() {
  return (
    <div className="flex overflow-hidden rounded-lg bg-white shadow-soft sm:flex-col">
      <Skeleton className="h-32 w-28 shrink-0 rounded-none sm:aspect-[3/2] sm:h-auto sm:w-full" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="mt-2 flex items-center justify-between">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-11 w-24 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/** Grille de squelettes de cartes (même gabarit que les vraies, donc pas de décalage). */
export function ArticleGridSkeleton({ count = 6 }: { count?: number }) {
  const { t } = useTranslation()
  return (
    <div role="status" aria-label={t('common.loading')}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <ArticleCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MenuSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <ArticleGridSkeleton />
      <ArticleGridSkeleton count={3} />
    </div>
  )
}
