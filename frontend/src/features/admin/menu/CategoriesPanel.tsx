import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertIcon,
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
  Skeleton,
  Switch,
  useToast,
} from '@/components/ui'
import { toAppError } from '@/lib/errors'
import { useLang } from '@/lib/useLang'
import type { AdminCategory } from '@/lib/types'
import { adminErrorMessage } from '../adminErrors'
import {
  useAdminCategories,
  useReorderCategories,
  useSaveCategory,
  useSetCategoryActive,
} from './api'
import { CATEGORY_NAME_MAX, moveItem, validateCategory, type MenuErrorCode } from './validation'

function CategoryDialog({
  category,
  open,
  onClose,
}: {
  category: AdminCategory | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const save = useSaveCategory()
  const [values, setValues] = useState({
    nomFr: category?.nomFr ?? '',
    nomAr: category?.nomAr ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<'nomFr' | 'nomAr', string>>>({})
  const [general, setGeneral] = useState<string>()

  const codeMessage = (code: MenuErrorCode) =>
    t(`admin.menu.errors.${code}`, { max: CATEGORY_NAME_MAX })

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setGeneral(undefined)
    const codes = validateCategory(values)
    const mapped = Object.fromEntries(
      Object.entries(codes).map(([k, code]) => [k, codeMessage(code)]),
    ) as typeof errors
    setErrors(mapped)
    if (Object.keys(mapped).length > 0) return
    try {
      await save.mutateAsync({ id: category?.id, values })
      toast(t('admin.common.saved'), { variant: 'success' })
      onClose()
    } catch (error) {
      const e = toAppError(error)
      const fields: typeof errors = {}
      for (const key of ['nomFr', 'nomAr'] as const) {
        const message = e.fieldError(key)
        if (message) fields[key] = message
      }
      if (e.status === 409) fields.nomFr = t('admin.menu.category.nameTaken')
      setErrors(fields)
      if (Object.keys(fields).length === 0) setGeneral(adminErrorMessage(error, t))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={category ? t('admin.menu.category.edit') : t('admin.menu.category.new')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="category-form" loading={save.isPending}>
            {t('admin.common.save')}
          </Button>
        </>
      }
    >
      <form
        id="category-form"
        onSubmit={(event) => void onSubmit(event)}
        noValidate
        className="flex flex-col gap-4"
      >
        {general && (
          <p role="alert" className="flex items-start gap-2 text-sm font-medium text-danger-800">
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            {general}
          </p>
        )}
        <Input
          name="nomFr"
          label={t('admin.menu.nameFr')}
          value={values.nomFr}
          onChange={(event) => setValues((v) => ({ ...v, nomFr: event.target.value }))}
          error={errors.nomFr}
          required
          data-autofocus
        />
        <Input
          name="nomAr"
          label={t('admin.menu.nameAr')}
          value={values.nomAr}
          onChange={(event) => setValues((v) => ({ ...v, nomAr: event.target.value }))}
          error={errors.nomAr}
          dir="rtl"
          required
        />
      </form>
    </Dialog>
  )
}

export function CategoriesPanel() {
  const { t } = useTranslation()
  const lang = useLang()
  const { toast } = useToast()
  const { data, isPending, isError, error, refetch, isFetching } = useAdminCategories()
  const reorder = useReorderCategories()
  const setActive = useSetCategoryActive()
  const [editing, setEditing] = useState<AdminCategory | null | 'new'>(null)
  const [announcement, setAnnouncement] = useState('')

  const sorted = [...(data ?? [])].sort((a, b) => a.ordre - b.ordre)
  const name = (c: AdminCategory) => (lang === 'ar' ? c.nomAr : c.nomFr)

  const move = (index: number, delta: -1 | 1) => {
    const ids = sorted.map((c) => c.id)
    const moved = moveItem(ids, index, delta)
    if (moved.every((id, i) => id === ids[i])) return
    const category = sorted[index]
    reorder.mutate(moved, {
      onError: (error) => toast(adminErrorMessage(error, t), { variant: 'error' }),
    })
    if (category) {
      setAnnouncement(
        t('admin.menu.category.moved', { name: name(category), position: index + delta + 1 }),
      )
    }
  }

  const toggle = (category: AdminCategory, estActive: boolean) =>
    setActive.mutate(
      { id: category.id, estActive },
      {
        onError: (error) =>
          toast(adminErrorMessage(error, t, 'admin.menu.category.deactivateConflict'), {
            variant: 'error',
          }),
      },
    )

  return (
    <div className="flex flex-col gap-4">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}>{t('admin.menu.category.new')}</Button>
      </div>

      {isPending && (
        <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} />}
      {data && sorted.length === 0 && (
        <EmptyState icon={<PlateIcon />} title={t('admin.menu.category.empty')} />
      )}

      <ol className="flex flex-col gap-3">
        {sorted.map((category, index) => (
          <li
            key={category.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4 shadow-soft"
          >
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold">{category.nomFr}</p>
              <p dir="rtl" className="text-ink-700">
                {category.nomAr}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge tone={category.estActive ? 'olive' : 'neutral'}>
                  {category.estActive ? t('admin.common.active') : t('admin.common.inactive')}
                </Badge>
                <span className="tabular text-xs text-ink-500">
                  {t('admin.menu.activeArticles', { count: category.nombreArticlesActifs })}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Switch
                checked={category.estActive}
                onChange={(value) => toggle(category, value)}
                label={t('admin.common.active')}
                srContext={name(category)}
              />
              <button
                type="button"
                aria-disabled={index === 0 || undefined}
                onClick={() => move(index, -1)}
                aria-label={t('admin.menu.moveUp', { name: name(category) })}
                className="grid size-11 place-items-center rounded-full hover:bg-sand-200 aria-disabled:opacity-35"
              >
                <ArrowUpIcon />
              </button>
              <button
                type="button"
                aria-disabled={index === sorted.length - 1 || undefined}
                onClick={() => move(index, 1)}
                aria-label={t('admin.menu.moveDown', { name: name(category) })}
                className="grid size-11 place-items-center rounded-full hover:bg-sand-200 aria-disabled:opacity-35"
              >
                <ArrowDownIcon />
              </button>
              <Button
                variant="outline"
                size="sm"
                icon={<EditIcon className="size-4" />}
                onClick={() => setEditing(category)}
                aria-label={`${t('admin.common.edit')} ${name(category)}`}
              >
                {t('admin.common.edit')}
              </Button>
            </div>
          </li>
        ))}
      </ol>

      {editing !== null && (
        <CategoryDialog
          key={editing === 'new' ? 'new' : editing.id}
          category={editing === 'new' ? null : editing}
          open
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
