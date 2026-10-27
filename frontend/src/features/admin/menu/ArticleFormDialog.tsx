import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertIcon,
  Button,
  Dialog,
  ErrorState,
  Field,
  Input,
  SelectField,
  Skeleton,
  useToast,
} from '@/components/ui'
import { FALLBACK_IMAGE, resolveImage } from '@/features/menu/images'
import { cn } from '@/lib/cn'
import { toAppError } from '@/lib/errors'
import type { AdminArticle, AdminCategory } from '@/lib/types'
import { adminErrorMessage } from '../adminErrors'
import { useSaveArticle } from './api'
import {
  DESCRIPTION_MAX,
  EMPTY_ARTICLE,
  NAME_MAX,
  isValidImageUrl,
  validateArticle,
  type ArticleField,
  type ArticleFormValues,
} from './validation'

const control =
  'block w-full rounded-md border-[1.5px] bg-white px-4 py-3 text-base text-ink-900 transition-colors hover:border-ink-500'

function toValues(article: AdminArticle | null, defaultCategory: number | null): ArticleFormValues {
  if (!article) return { ...EMPTY_ARTICLE, categorieId: defaultCategory }
  return {
    categorieId: article.categorieId,
    nomFr: article.nomFr,
    descriptionFr: article.descriptionFr ?? '',
    prix: String(article.prix).replace('.', ','),
    imageUrl: article.imageUrl ?? '',
    estPopulaire: article.estPopulaire,
    estDisponible: article.estDisponible,
  }
}

/** Aperçu : chemin local via resolveImage (les photos trop lourdes sont remplacées), URL https telle quelle. */
function previewSrc(url: string): string {
  const value = url.trim()
  if (!value) return FALLBACK_IMAGE
  if (!isValidImageUrl(value)) return FALLBACK_IMAGE
  return value.startsWith('/') ? resolveImage(value) : value
}

export interface CategoriesStatus {
  isPending: boolean
  isError: boolean
  error?: unknown
  onRetry: () => void
  retrying: boolean
}

interface ArticleFormDialogProps {
  article: AdminArticle | null
  /** Absent tant que les catégories chargent ou en cas d'erreur : le formulaire reste utilisable. */
  categories?: AdminCategory[]
  categoriesStatus: CategoriesStatus
  defaultCategory: number | null
  onClose: () => void
}

export function ArticleFormDialog({
  article,
  categories,
  categoriesStatus,
  defaultCategory,
  onClose,
}: ArticleFormDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const save = useSaveArticle()
  const [values, setValues] = useState(() => toValues(article, defaultCategory))
  const [errors, setErrors] = useState<Partial<Record<ArticleField, string>>>({})
  const [general, setGeneral] = useState<string>()
  const [imageBroken, setImageBroken] = useState(false)

  const blocked = !categories && values.categorieId === null

  const set = <K extends keyof ArticleFormValues>(key: K, value: ArticleFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const codeMessage = (code: string) =>
    t(`admin.menu.errors.${code}`, { max: NAME_MAX, descMax: DESCRIPTION_MAX })

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    setGeneral(undefined)
    if (blocked) return
    const codes = validateArticle(values)
    const mapped: Partial<Record<ArticleField, string>> = {}
    for (const [key, code] of Object.entries(codes)) mapped[key as ArticleField] = codeMessage(code)
    setErrors(mapped)
    const first = (Object.keys(mapped) as ArticleField[])[0]
    if (first) {
      ;(form.elements.namedItem(first) as HTMLElement | null)?.focus()
      return
    }
    try {
      await save.mutateAsync({ id: article?.id, values })
      toast(t('admin.common.saved'), { variant: 'success' })
      onClose()
    } catch (error) {
      const e = toAppError(error)
      const fields: Partial<Record<ArticleField, string>> = {}
      for (const key of ['categorieId', 'nomFr', 'prix', 'imageUrl', 'descriptionFr'] as const) {
        const message = e.fieldError(key)
        if (message) fields[key] = message
      }
      setErrors(fields)
      setGeneral(
        Object.keys(fields).length > 0 ? t('auth.errors.form') : adminErrorMessage(error, t),
      )
    }
  }

  const src = previewSrc(values.imageUrl)

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={article ? t('admin.menu.article.edit') : t('admin.menu.article.new')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="article-form"
            loading={save.isPending}
            aria-disabled={blocked || undefined}
            aria-describedby={blocked ? 'category-needed' : undefined}
          >
            {t('admin.common.save')}
          </Button>
        </>
      }
    >
      <form
        id="article-form"
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
        {categories ? (
          <SelectField
            name="categorieId"
            label={t('admin.menu.article.category')}
            value={values.categorieId ?? ''}
            onChange={(event) =>
              set('categorieId', event.target.value === '' ? null : Number(event.target.value))
            }
            error={errors.categorieId}
            required
          >
            <option value="">{t('admin.menu.article.chooseCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nomFr}
                {c.estActive ? '' : ` (${t('admin.common.inactive')})`}
              </option>
            ))}
          </SelectField>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink-800">
              {t('admin.menu.article.category')}
            </span>
            {categoriesStatus.isPending && (
              <div role="status" aria-label={t('common.loading')}>
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            )}
            {!categoriesStatus.isPending && values.categorieId !== null && (
              <input
                type="text"
                disabled
                aria-label={t('admin.menu.article.category')}
                value={t('admin.menu.article.categoryCurrent', { id: values.categorieId })}
                className="block min-h-12 w-full rounded-md border-[1.5px] border-sand-300 bg-sand-100 px-4 text-ink-700"
              />
            )}
            {categoriesStatus.isError && (
              <ErrorState
                compact
                error={categoriesStatus.error}
                message={t('admin.menu.article.categoriesError')}
                onRetry={categoriesStatus.onRetry}
                retrying={categoriesStatus.retrying}
              />
            )}
          </div>
        )}
        <div className="grid gap-4">
          <Input
            name="nomFr"
            label={t('admin.menu.nameFr')}
            value={values.nomFr}
            onChange={(event) => set('nomFr', event.target.value)}
            error={errors.nomFr}
            required
          />
          <Field
            label={t('admin.menu.article.descriptionFr')}
            error={errors.descriptionFr}
            optional
          >
            {(c) => (
              <textarea
                name="descriptionFr"
                rows={3}
                value={values.descriptionFr}
                onChange={(event) => set('descriptionFr', event.target.value)}
                className={cn(control, c['aria-invalid'] ? 'border-danger-600' : 'border-sand-400')}
                {...c}
              />
            )}
          </Field>
        </div>
        <Input
          name="prix"
          label={t('admin.menu.article.price')}
          hint={t('admin.menu.article.priceHint')}
          value={values.prix}
          onChange={(event) => set('prix', event.target.value)}
          error={errors.prix}
          inputMode="decimal"
          ltr
          required
        />
        <div className="grid items-start gap-4 sm:grid-cols-[1fr_8rem]">
          <Input
            name="imageUrl"
            label={t('admin.menu.article.imageUrl')}
            hint={t('admin.menu.article.imageHelp')}
            value={values.imageUrl}
            onChange={(event) => {
              set('imageUrl', event.target.value)
              setImageBroken(false)
            }}
            error={errors.imageUrl}
            placeholder="/images/lablabi.webp"
            inputMode="url"
            ltr
            optional
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink-800">
              {t('admin.menu.article.preview')}
            </span>
            <img
              src={imageBroken ? FALLBACK_IMAGE : src}
              alt=""
              width={192}
              height={128}
              loading="lazy"
              onError={() => setImageBroken(true)}
              className="aspect-[3/2] w-full rounded-md bg-sand-200 object-cover"
            />
          </div>
        </div>
        {blocked && (
          <p id="category-needed" className="text-sm font-medium text-danger-800">
            {t('admin.menu.article.categoryNeeded')}
          </p>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={values.estPopulaire}
              onChange={(event) => set('estPopulaire', event.target.checked)}
              className="size-5 accent-terracotta-600"
            />
            {t('admin.menu.article.popular')}
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={values.estDisponible}
              onChange={(event) => set('estDisponible', event.target.checked)}
              className="size-5 accent-terracotta-600"
            />
            {t('admin.menu.article.available')}
          </label>
        </div>
      </form>
    </Dialog>
  )
}
