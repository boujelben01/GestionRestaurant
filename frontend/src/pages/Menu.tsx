import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  CloseIcon,
  EmptyState,
  ErrorState,
  PlateIcon,
  Reveal,
  SearchIcon,
  Skeleton,
  StarIcon,
} from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { ArticleCard } from '@/features/menu/ArticleCard'
import { useMenu } from '@/features/menu/api'
import { CategoryNav } from '@/features/menu/CategoryNav'
import { countArticles, filterCategories } from '@/features/menu/filter'
import { MenuSkeleton } from '@/features/menu/MenuSkeleton'
import { categoryAnchor, useScrollSpy } from '@/features/menu/useScrollSpy'
import { cn } from '@/lib/cn'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

const SEARCH_DELAY_MS = 250

export default function Menu() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const { data, isPending, isError, refetch, isFetching } = useMenu()

  const [query, setQuery] = useState('')
  const [popularOnly, setPopularOnly] = useState(false)
  const debouncedQuery = useDebouncedValue(query, SEARCH_DELAY_MS)

  const categories = useMemo(
    () => (data ? filterCategories(data, { query: debouncedQuery, popularOnly }) : []),
    [data, debouncedQuery, popularOnly],
  )
  const total = countArticles(categories)
  const filtering = debouncedQuery.trim() !== '' || popularOnly
  const ids = useMemo(() => categories.map((c) => c.id), [categories])
  const { activeId, select } = useScrollSpy(ids)

  const addHint = isAuthenticated ? t('common.comingSoon') : t('menu.signInToOrder')
  const reset = () => {
    setQuery('')
    setPopularOnly(false)
  }

  return (
    <>
      <Seo title={t('seo.menuTitle')} description={t('seo.menuDescription')} />
      <PageHeader title={t('menu.title')} subtitle={t('menu.subtitle')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-md">
            <label htmlFor="menu-search" className="sr-only">
              {t('menu.search')}
            </label>
            <SearchIcon className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-ink-500" />
            <input
              id="menu-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('menu.searchPlaceholder')}
              autoComplete="off"
              enterKeyHint="search"
              disabled={isPending || isError}
              className="block min-h-12 w-full rounded-full border-[1.5px] border-sand-400 bg-white ps-12 pe-12 text-base text-ink-900 transition-colors duration-200 placeholder:text-ink-500 hover:border-ink-500 disabled:opacity-60 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('menu.clearSearch')}
                className="absolute end-0.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-ink-700 transition-colors hover:bg-sand-200"
              >
                <CloseIcon className="size-5" />
              </button>
            )}
          </div>
          <button
            type="button"
            aria-pressed={popularOnly}
            onClick={() => setPopularOnly((value) => !value)}
            disabled={isPending || isError}
            className={cn(
              'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] px-5 text-sm font-semibold transition-colors duration-200 disabled:opacity-60',
              popularOnly
                ? 'border-gold-800 bg-gold-100 text-gold-800'
                : 'border-sand-400 bg-white text-ink-800 hover:border-ink-500',
            )}
          >
            <StarIcon className={cn('size-4.5', popularOnly && 'fill-current')} />
            {t('menu.popularOnly')}
          </button>
        </div>
        <p role="status" aria-live="polite" className="mt-3 min-h-6 text-sm text-ink-700">
          {data && t('menu.resultCount', { count: total })}
        </p>
      </PageHeader>

      {categories.length > 0 && (
        <div className="sticky top-16 z-20 border-b border-sand-200 bg-sand-50/95 backdrop-blur-md sm:top-[4.5rem]">
          <div className="container-page">
            <CategoryNav categories={categories} activeId={activeId} onSelect={select} />
          </div>
        </div>
      )}

      <div className="container-page pb-4">
        {isPending && (
          <div className="pt-8">
            <Skeleton className="mb-6 h-8 w-48" />
            <MenuSkeleton />
          </div>
        )}

        {isError && (
          <div className="pt-10">
            <ErrorState
              message={t('menu.loadError')}
              onRetry={() => void refetch()}
              retrying={isFetching}
            />
          </div>
        )}

        {data && data.length === 0 && (
          <div className="pt-10">
            <EmptyState
              icon={<PlateIcon />}
              title={t('menu.emptyTitle')}
              description={t('menu.emptyText')}
            />
          </div>
        )}

        {data && data.length > 0 && filtering && categories.length === 0 && (
          <div className="pt-10">
            <EmptyState
              icon={<SearchIcon />}
              title={t('menu.noResultsTitle')}
              description={t('menu.noResultsText')}
              action={
                <Button variant="outline" size="sm" onClick={reset}>
                  {t('menu.resetFilters')}
                </Button>
              }
            />
          </div>
        )}

        {categories.map((category) => (
          <section
            key={category.id}
            id={categoryAnchor(category.id)}
            aria-labelledby={`${categoryAnchor(category.id)}-title`}
            className="scroll-mt-[8.5rem] pt-10 sm:scroll-mt-[9rem]"
          >
            <div className="mb-5 flex items-center gap-3">
              <h2 id={`${categoryAnchor(category.id)}-title`} className="text-2xl sm:text-3xl">
                {category.nom}
              </h2>
              <Badge tone="neutral">{category.articles.length}</Badge>
            </div>
            {category.articles.length === 0 ? (
              <EmptyState
                compact
                icon={<PlateIcon />}
                title={t('menu.emptyCategoryTitle')}
                description={t('menu.emptyCategoryText')}
              />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {category.articles.map((article, index) => (
                  <Reveal as="li" key={article.id} index={index % 3} className="h-full">
                    <ArticleCard article={article} addHint={addHint} />
                  </Reveal>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  )
}
