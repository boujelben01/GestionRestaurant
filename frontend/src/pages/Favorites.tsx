import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { PageHeader } from '@/components/layout/PageHeader'
import { ArrowIcon, Button, EmptyState, ErrorState, HeartIcon, Reveal } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { ConnectedArticleCard } from '@/features/cart/ConnectedArticleCard'
import { useFavorites } from '@/features/favorites/api'
import { ArticleGridSkeleton } from '@/features/menu/MenuSkeleton'

/** /favoris : les plats mis de côté ; un plat retiré du menu reste listé (grisé) pour pouvoir être retiré. */
export default function Favorites() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const { data, isPending, isError, error, refetch, isFetching } = useFavorites()

  // Les administrateurs ne commandent pas : pas de favoris.
  if (hasRole('Admin')) return <Navigate to="/admin" replace />

  return (
    <>
      <Seo title={t('favorites.title')} noindex />
      <PageHeader title={t('favorites.title')} subtitle={t('favorites.subtitle')}>
        {data && data.length > 0 && (
          <p role="status" aria-live="polite" className="font-semibold text-ink-700">
            {t('favorites.count', { count: data.length })}
          </p>
        )}
      </PageHeader>
      <div className="container-page flex-1 py-8">
        {isPending && <ArticleGridSkeleton count={3} />}
        {isError && (
          <ErrorState
            error={error}
            message={t('favorites.loadError')}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        )}
        {data && data.length === 0 && (
          <EmptyState
            icon={<HeartIcon />}
            title={t('favorites.emptyTitle')}
            description={t('favorites.emptyText')}
            action={
              <Button to="/menu" icon={<ArrowIcon />}>
                {t('common.seeMenu')}
              </Button>
            }
          />
        )}
        {data && data.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((article, index) => (
              <Reveal as="li" key={article.id} index={index % 3} className="h-full">
                <ConnectedArticleCard article={article} unlisted={!article.actif} />
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
