import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import {
  AlertIcon,
  Badge,
  Button,
  Card,
  Dialog,
  ErrorState,
  Input,
  Skeleton,
  Switch,
  useToast,
} from '@/components/ui'
import { adminErrorMessage } from '@/features/admin/adminErrors'
import { useSaveHoraires, useSaveSettings, useSetOrdersOpen } from '@/features/admin/restaurant/api'
import {
  isOvernight,
  toDayForms,
  validateDay,
  validateSettings,
  daysAreValid,
  type DayForm,
  type SettingsField,
  type SettingsFormValues,
} from '@/features/admin/restaurant/validation'
import { WEEK_ORDER } from '@/features/restaurant/hours'
import { useRestaurant } from '@/features/restaurant/api'
import { toAppError } from '@/lib/errors'
import { weekdayName } from '@/lib/format'
import type { Restaurant } from '@/lib/types'
import { useLang } from '@/lib/useLang'

const toText = (n: number) => String(n).replace('.', ',')

function settingsOf(r: Restaurant): SettingsFormValues {
  return {
    nom: r.nom,
    telephone: r.telephone,
    email: r.email,
    adresse: r.adresse,
    fraisLivraison: toText(r.fraisLivraison),
    montantMinimumLivraison: toText(r.montantMinimumLivraison),
  }
}

function OrdersOpenCard({ restaurant }: { restaurant: Restaurant }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const toggle = useSetOrdersOpen()
  const [confirmClose, setConfirmClose] = useState(false)

  const apply = (open: boolean) =>
    toggle.mutate(open, {
      onSuccess: () =>
        toast(open ? t('admin.restaurant.nowOpen') : t('admin.restaurant.nowClosed'), {
          variant: 'success',
        }),
      onError: (error) => toast(adminErrorMessage(error, t), { variant: 'error' }),
    })

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl">{t('admin.restaurant.ordersTitle')}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={restaurant.commandesOuvertes ? 'olive' : 'danger'} dot>
              {restaurant.commandesOuvertes
                ? t('admin.restaurant.ordersOn')
                : t('admin.restaurant.ordersOff')}
            </Badge>
            <Badge tone={restaurant.ouvertMaintenant ? 'olive' : 'neutral'} dot>
              {restaurant.ouvertMaintenant ? t('restaurant.openNow') : t('restaurant.closedNow')}
            </Badge>
          </div>
          <p className="mt-2 max-w-xl text-sm text-ink-700">{t('admin.restaurant.ordersHelp')}</p>
        </div>
        <Switch
          checked={restaurant.commandesOuvertes}
          disabled={toggle.isPending}
          onChange={(value) => (value ? apply(true) : setConfirmClose(true))}
          label={t('admin.restaurant.takeOrders')}
        />
      </div>

      <Dialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title={t('admin.restaurant.closeTitle')}
        description={t('admin.restaurant.closeText')}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmClose(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmClose(false)
                apply(false)
              }}
            >
              {t('admin.restaurant.closeConfirm')}
            </Button>
          </>
        }
      />
    </Card>
  )
}

function SettingsCard({ restaurant }: { restaurant: Restaurant }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const save = useSaveSettings()
  const initial = settingsOf(restaurant)
  const [values, setValues] = useState<SettingsFormValues>(initial)
  const [errors, setErrors] = useState<Partial<Record<SettingsField, string>>>({})
  const [general, setGeneral] = useState<string>()
  const dirty = (Object.keys(initial) as SettingsField[]).some((k) => values[k] !== initial[k])

  const set = (key: SettingsField) => (event: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: event.target.value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    setGeneral(undefined)
    const codes = validateSettings(values)
    const mapped: Partial<Record<SettingsField, string>> = {}
    for (const [key, code] of Object.entries(codes)) {
      mapped[key as SettingsField] = t(`admin.restaurant.errors.${code}`)
    }
    setErrors(mapped)
    const first = (Object.keys(mapped) as SettingsField[])[0]
    if (first) {
      ;(form.elements.namedItem(first) as HTMLElement | null)?.focus()
      return
    }
    try {
      await save.mutateAsync(values)
      toast(t('admin.common.saved'), { variant: 'success' })
    } catch (error) {
      const e = toAppError(error)
      const fields: Partial<Record<SettingsField, string>> = {}
      for (const key of Object.keys(initial) as SettingsField[]) {
        const message = e.fieldError(key)
        if (message) fields[key] = message
      }
      setErrors(fields)
      setGeneral(
        Object.keys(fields).length > 0 ? t('auth.errors.form') : adminErrorMessage(error, t),
      )
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xl sm:text-2xl">{t('admin.restaurant.settingsTitle')}</h2>
      <form
        onSubmit={(event) => void onSubmit(event)}
        noValidate
        className="mt-5 grid gap-5 sm:grid-cols-2"
      >
        {general && (
          <p
            role="alert"
            className="flex items-start gap-2 text-sm font-medium text-danger-800 sm:col-span-2"
          >
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            {general}
          </p>
        )}
        <Input
          name="nom"
          label={t('admin.restaurant.name')}
          value={values.nom}
          onChange={set('nom')}
          error={errors.nom}
          required
        />
        <Input
          name="telephone"
          type="tel"
          label={t('contact.phone')}
          value={values.telephone}
          onChange={set('telephone')}
          error={errors.telephone}
          ltr
          required
        />
        <Input
          name="email"
          type="email"
          label={t('contact.email')}
          value={values.email}
          onChange={set('email')}
          error={errors.email}
          ltr
          required
        />
        <Input
          name="adresse"
          label={t('contact.address')}
          value={values.adresse}
          onChange={set('adresse')}
          error={errors.adresse}
          required
        />
        <Input
          name="fraisLivraison"
          label={t('admin.restaurant.deliveryFee')}
          hint={t('admin.menu.article.priceHint')}
          value={values.fraisLivraison}
          onChange={set('fraisLivraison')}
          error={errors.fraisLivraison}
          inputMode="decimal"
          ltr
          required
        />
        <Input
          name="montantMinimumLivraison"
          label={t('admin.restaurant.deliveryMinimum')}
          hint={t('admin.menu.article.priceHint')}
          value={values.montantMinimumLivraison}
          onChange={set('montantMinimumLivraison')}
          error={errors.montantMinimumLivraison}
          inputMode="decimal"
          ltr
          required
        />
        <div className="sm:col-span-2">
          <Button type="submit" size="lg" loading={save.isPending} disabled={!dirty}>
            {t('admin.common.save')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function HoursCard({ restaurant }: { restaurant: Restaurant }) {
  const { t } = useTranslation()
  const lang = useLang()
  const { toast } = useToast()
  const save = useSaveHoraires()
  const initial = toDayForms(restaurant.horaires)
  const [days, setDays] = useState<DayForm[]>(initial)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [showErrors, setShowErrors] = useState(false)
  const [general, setGeneral] = useState<string>()
  const dirty = JSON.stringify(days) !== JSON.stringify(initial)

  const patch = (day: number, change: Partial<DayForm>) => {
    setDays((current) => current.map((d) => (d.jourSemaine === day ? { ...d, ...change } : d)))
    setServerErrors({})
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setGeneral(undefined)
    if (!daysAreValid(days)) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    try {
      await save.mutateAsync(days)
      toast(t('admin.common.saved'), { variant: 'success' })
    } catch (error) {
      const e = toAppError(error)
      const fields: Record<string, string> = {}
      days.forEach((d, index) => {
        for (const key of ['ouverture', 'fermeture'] as const) {
          const message = e.fieldError(`horaires[${index}].${key}`)
          if (message) fields[`${d.jourSemaine}-${key}`] = message
        }
      })
      setServerErrors(fields)
      setGeneral(
        Object.keys(fields).length > 0 ? t('auth.errors.form') : adminErrorMessage(error, t),
      )
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xl sm:text-2xl">{t('admin.restaurant.hoursTitle')}</h2>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="mt-4">
        {general && (
          <p
            role="alert"
            className="mb-3 flex items-start gap-2 text-sm font-medium text-danger-800"
          >
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            {general}
          </p>
        )}
        <ul className="flex flex-col divide-y divide-sand-200">
          {WEEK_ORDER.map((jour) => {
            const day = days[jour]
            if (!day) return null
            const errs = showErrors ? validateDay(day) : {}
            const name = weekdayName(jour, lang)
            const overnight = isOvernight(day)
            const errorOf = (key: 'ouverture' | 'fermeture') => {
              const code = errs[key]
              return code ? t(`admin.restaurant.dayErrors.${code}`) : serverErrors[`${jour}-${key}`]
            }
            return (
              <li key={jour} className="flex flex-wrap items-start gap-x-6 gap-y-2 py-3">
                <p className="w-28 pt-3 font-semibold">{name}</p>
                <Switch
                  checked={day.estFerme}
                  onChange={(value) => patch(jour, { estFerme: value })}
                  label={t('restaurant.closed')}
                  srContext={name}
                />
                {!day.estFerme && (
                  <div className="flex flex-wrap items-start gap-3">
                    <Input
                      type="time"
                      name={`ouverture-${jour}`}
                      label={t('admin.restaurant.opening')}
                      value={day.ouverture}
                      onChange={(event) => patch(jour, { ouverture: event.target.value })}
                      error={errorOf('ouverture')}
                      wrapperClassName="w-36"
                      ltr
                    />
                    <Input
                      type="time"
                      name={`fermeture-${jour}`}
                      label={t('admin.restaurant.closing')}
                      value={day.fermeture}
                      onChange={(event) => patch(jour, { fermeture: event.target.value })}
                      error={errorOf('fermeture')}
                      wrapperClassName="w-36"
                      ltr
                    />
                    {overnight && (
                      <p className="pt-9 text-sm font-semibold text-sidi-700">
                        {t('restaurant.afterMidnight')}
                      </p>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <div className="mt-4">
          <Button type="submit" size="lg" loading={save.isPending} disabled={!dirty}>
            {t('admin.common.save')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

export default function AdminRestaurant() {
  const { t } = useTranslation()
  const { data, isPending, isError, error, refetch, isFetching } = useRestaurant()
  // key = contenu serveur : le formulaire se réinitialise après un enregistrement réussi.
  const settingsKey = data ? JSON.stringify(settingsOf(data)) : 'none'
  const hoursKey = data ? JSON.stringify(toDayForms(data.horaires)) : 'none'

  return (
    <>
      <Seo title={t('admin.nav.restaurant')} noindex />
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {isPending && (
          <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        )}
        {isError && (
          <ErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} />
        )}
        {data && (
          <>
            <OrdersOpenCard restaurant={data} />
            <SettingsCard key={settingsKey} restaurant={data} />
            <HoursCard key={hoursKey} restaurant={data} />
          </>
        )}
      </div>
    </>
  )
}
