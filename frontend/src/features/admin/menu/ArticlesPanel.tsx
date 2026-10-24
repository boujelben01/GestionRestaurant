import { useState, type SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Badge,
  Button,
  Dialog,
  EditIcon,
  EmptyState,
  ErrorState,
  Input,
  PlateIcon,
  Pagination,
  SelectField,
  Skeleton,
  Switch,
  useToast,
} from '@/components/ui'
import { FALLBACK_IMAGE, resolveImage } from '@/features/menu/images'
import { formatPrice } from '@/lib/format'
import type { AdminArticle } from '@/lib/types'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { useLang } from '@/lib/useLang'
import { adminErrorMessage } from '../adminErrors'
import {
  EMPTY_ARTICLE_FILTERS,
  useAdminArticles,
  useAdminCategories,
  useReorderArticles,
  useSetArticleActive,
  useSetArticleAvailable,
  type ArticleFilters,
} from './api'
import { ArticleFormDialog } from './ArticleFormDialog'
import { moveItem } from './validation'

const PAGE_SIZE = 20
/** Taille maximale de page de l'API : sert à charger toute une catégorie pour la réordonner. */
const REORDER_PAGE_SIZE = 50

function swapToFallback(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget
  if (!img.src.endsWith(FALLBACK_IMAGE)) img.src = FALLBACK_IMAGE
}

export function ArticlesPanel() {
  const { t } = useTranslation()
  const lang = useLang()
  const { toast } = useToast()
  const [filters, setFilters] = useState<ArticleFilters>(EMPTY_ARTICLE_FILTERS)
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<AdminArticle | 'new' | null>(null)
  const [confirmOff, setConfirmOff] = useState<AdminArticle | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const debounced = useDebouncedValue(searchText, 300)
  const effective: ArticleFilters = { ...filters, recherche: debounced }
  // Réordonner n'a de sens que pour UNE catégorie, sans autre filtre : on la charge d'un bloc.
  const reorderMode =
    filters.categorieId !== null &&
    filters.actif === null &&
    filters.disponible === null &&
    debounced.trim() === ''
  const pageSize = reorderMode ? REORDER_PAGE_SIZE : PAGE_SIZE
  const effectivePage = reorderMode ? 1 : page

  const { data, isPending, isError, error, refetch, isFetching } = useAdminArticles(
    effective,
    effectivePage,
    pageSize,
  )
  const {
    data: categories,
    isPending: categoriesPending,
    isError: categoriesError,
    error: categoriesErrorValue,
    refetch: refetchCategories,
    isFetching: categoriesFetching,
  } = useAdminCategories()
  const setAvailable = useSetArticleAvailable()
  const setActive = useSetArticleActive()
  const reorder = useReorderArticles()

  const categoryName = (id: number) => {
    const c = categories?.find((x) => x.id === id)
    return c ? (lang === 'ar' ? c.nomAr : c.nomFr) : ''
  }
  const articleName = (a: AdminArticle) => (lang === 'ar' ? a.nomAr : a.nomFr)
  const tooMany = reorderMode && (data?.total ?? 0) > REORDER_PAGE_SIZE
  const canReorder = reorderMode && !tooMany

  const update = (patch: Partial<ArticleFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
  }
  const reset = () => {
    setFilters(EMPTY_ARTICLE_FILTERS)
    setSearchText('')
    setPage(1)
  }
  const dirty =
    filters.categorieId !== null ||
    filters.actif !== null ||
    filters.disponible !== null ||
    searchText !== ''

  const move = (index: number, delta: -1 | 1) => {
    if (!data) return
    const ids = data.items.map((a) => a.id)
    const moved = moveItem(ids, index, delta)
    if (moved.every((id, i) => id === ids[i])) return
    const article = data.items[index]
    reorder.mutate(moved, {
      onError: (error) => toast(adminErrorMessage(error, t), { variant: 'error' }),
    })
    if (article) {
      setAnnouncement(
        t('admin.menu.article.moved', { name: articleName(article), position: index + delta + 1 }),
      )
    }
  }

  const toggleAvailable = (article: AdminArticle, value: boolean) =>
    setAvailable.mutate(
      { id: article.id, value },
      { onError: (e) => toast(adminErrorMessage(e, t), { variant: 'error' }) },
    )

  const toggleActive = (article: AdminArticle, value: boolean) =>
    setActive.mutate(
      { id: article.id, value },
      { onError: (e) => toast(adminErrorMessage(e, t), { variant: 'error' }) },
    )

  return (
    <div className="flex flex-col gap-4">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow-soft">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label={t('admin.menu.article.category')}
            value={filters.categorieId ?? ''}
            onChange={(event) =>
              update({ categorieId: event.target.value === '' ? null : Number(event.target.value) })
            }
          >
            <option value="">{t('admin.common.all')}</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {lang === 'ar' ? c.nomAr : c.nomFr}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('admin.menu.article.filterActive')}
            value={filters.actif === null ? '' : String(filters.actif)}
            onChange={(event) =>
              update({ actif: event.target.value === '' ? null : event.target.value === 'true' })
            }
          >
            <option value="">{t('admin.common.all')}</option>
            <option value="true">{t('admin.common.active')}</option>
            <option value="false">{t('admin.common.inactive')}</option>
          </SelectField>
          <SelectField
            label={t('admin.menu.article.filterAvailable')}
            value={filters.disponible === null ? '' : String(filters.disponible)}
            onChange={(event) =>
              update({
                disponible: event.target.value === '' ? null : event.target.value === 'true',
              })
            }
          >
            <option value="">{t('admin.common.all')}</option>
            <option value="true">{t('admin.menu.article.availableShort')}</option>
            <option value="false">{t('admin.menu.article.soldOut')}</option>
          </SelectField>
          <Input
            type="search"
            label={t('admin.common.search')}
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value)
              setPage(1)
            }}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="text-sm text-ink-700">
            {data && t('admin.common.results', { count: data.total })}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={reset} disabled={!dirty}>
              {t('admin.common.resetFilters')}
            </Button>
            <Button onClick={() => setEditing('new')}>{t('admin.menu.article.new')}</Button>
          </div>
        </div>
        {filters.categorieId !== null && !reorderMode && (
          <p className="text-sm text-ink-500">{t('admin.menu.article.reorderNeedsCategoryOnly')}</p>
        )}
        {tooMany && (
          <p className="text-sm text-danger-800">{t('admin.menu.article.reorderTooMany')}</p>
        )}
        {canReorder && (
          <p className="text-sm text-ink-500">{t('admin.menu.article.reorderHint')}</p>
        )}
      </div>

      {isPending && (
        <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      )}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} />}
      {data && data.items.length === 0 && (
        <EmptyState
          icon={<PlateIcon />}
          title={t('admin.menu.article.empty')}
          action={
            dirty ? (
              <Button variant="outline" size="sm" onClick={reset}>
                {t('admin.common.resetFilters')}
              </Button>
            ) : undefined
          }
        />
      )}

      <ul className="flex flex-col gap-3">
        {data?.items.map((article, index) => (
          <li
            key={article.id}
            className="flex flex-wrap items-center gap-4 rounded-lg bg-white p-3 shadow-soft"
          >
            <img
              src={article.imageUrl ? resolveImage(article.imageUrl) : FALLBACK_IMAGE}
              alt=""
              width={96}
              height={64}
              loading="lazy"
              decoding="async"
              onError={swapToFallback}
              className="h-16 w-24 shrink-0 rounded-md bg-sand-200 object-cover"
            />
            <div className="min-w-48 flex-1">
              <p className="font-display text-lg leading-tight font-semibold">{article.nomFr}</p>
              <p dir="rtl" className="text-sm text-ink-700">
                {article.nomAr}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                <span>{categoryName(article.categorieId)}</span>
                <span className="tabular text-sm font-bold text-terracotta-700">
                  {formatPrice(article.prix, lang)}
                </span>
                {article.estPopulaire && <Badge tone="gold">{t('menu.popular')}</Badge>}
                {!article.estActif && <Badge tone="neutral">{t('admin.common.inactive')}</Badge>}
                {!article.estDisponible && (
                  <Badge tone="danger">{t('admin.menu.article.soldOut')}</Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3">
              <Switch
                checked={article.estDisponible}
                onChange={(value) => toggleAvailable(article, value)}
                label={
                  article.estDisponible
                    ? t('admin.menu.article.availableShort')
                    : t('admin.menu.article.soldOut')
                }
                srContext={articleName(article)}
              />
              <Switch
                checked={article.estActif}
                onChange={(value) => (value ? toggleActive(article, true) : setConfirmOff(article))}
                label={t('admin.common.active')}
                srContext={articleName(article)}
              />
              {canReorder && (
                <span className="flex">
                  <button
                    type="button"
                    aria-disabled={index === 0 || undefined}
                    onClick={() => move(index, -1)}
                    aria-label={t('admin.menu.moveUp', { name: articleName(article) })}
                    className="grid size-11 place-items-center rounded-full hover:bg-sand-200 aria-disabled:opacity-35"
                  >
                    <ArrowUpIcon />
                  </button>
                  <button
                    type="button"
                    aria-disabled={index === data.items.length - 1 || undefined}
                    onClick={() => move(index, 1)}
                    aria-label={t('admin.menu.moveDown', { name: articleName(article) })}
                    className="grid size-11 place-items-center rounded-full hover:bg-sand-200 aria-disabled:opacity-35"
                  >
                    <ArrowDownIcon />
                  </button>
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                icon={<EditIcon className="size-4" />}
                onClick={() => setEditing(article)}
                aria-label={`${t('admin.common.edit')} ${articleName(article)}`}
              >
                {t('admin.common.edit')}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {data && !reorderMode && (
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
          onPage={setPage}
          busy={isFetching}
        />
      )}

      {editing !== null && (
        <ArticleFormDialog
          key={editing === 'new' ? 'new' : editing.id}
          article={editing === 'new' ? null : editing}
          categories={categories}
          categoriesStatus={{
            isPending: categoriesPending,
            isError: categoriesError,
            error: categoriesErrorValue,
            onRetry: () => void refetchCategories(),
            retrying: categoriesFetching,
          }}
          defaultCategory={filters.categorieId}
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog
        open={confirmOff !== null}
        onClose={() => setConfirmOff(null)}
        title={t('admin.menu.article.deactivateTitle')}
        description={t('admin.menu.article.deactivateText', {
          name: confirmOff ? articleName(confirmOff) : '',
        })}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOff(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmOff) toggleActive(confirmOff, false)
                setConfirmOff(null)
              }}
            >
              {t('admin.menu.article.deactivateConfirm')}
            </Button>
          </>
        }
      />
    </div>
  )
}
