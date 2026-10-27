import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  AlertIcon,
  ArrowIcon,
  BagIcon,
  BikeIcon,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Skeleton,
  TableIcon,
  useToast,
} from '@/components/ui'
import { useAddresses } from '@/features/addresses/api'
import { checkoutPrefill, defaultAddress } from '@/features/addresses/rules'
import { useAuth } from '@/features/auth/AuthContext'
import { useCustomerFeatures } from '@/features/favorites/api'
import { usePanier } from '@/features/cart/api'
import { blockedLines } from '@/features/cart/cartMath'
import { useCreateOrder } from '@/features/orders/api'
import {
  ADDRESS_MAX,
  ADDRESS_MIN,
  NOTE_MAX,
  OrderError,
  availableTypes,
  buildOrderRequest,
  deliveryInfo,
  previewTotal,
  validateCheckout,
  type CheckoutErrorCode,
  type CheckoutField,
  type CheckoutFieldErrors,
  type OrderFailure,
} from '@/features/orders/checkout'
import { TableBanner } from '@/features/orders/TableBanner'
import { leaveTable, useTableSession } from '@/features/orders/useTableSession'
import { useRestaurant } from '@/features/restaurant/api'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import type { TypeCommande } from '@/lib/types'
import { useLang } from '@/lib/useLang'

const control =
  'block w-full rounded-md border-[1.5px] bg-white px-4 py-3 text-base text-ink-900 transition-colors duration-200 placeholder:text-ink-500 hover:border-ink-500'

const FIELD_ORDER: CheckoutField[] = ['telephone', 'adresseLivraison', 'tableCode', 'note']

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="rounded-lg bg-white p-5 shadow-soft sm:p-6">
      <h2 id={`step-${n}`} className="mb-5 flex items-center gap-3 text-xl sm:text-2xl">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-terracotta-600 font-sans text-sm font-bold text-white"
        >
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Alert({
  children,
  tone = 'danger',
}: {
  children: ReactNode
  tone?: 'danger' | 'warning'
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-md border p-4 text-sm font-medium',
        tone === 'danger'
          ? 'border-danger-600/30 bg-danger-100 text-danger-800'
          : 'border-gold-800/30 bg-gold-100 text-gold-800',
      )}
    >
      <AlertIcon className="mt-0.5 size-5 shrink-0" />
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

const TYPE_ICONS: Record<TypeCommande, ReactNode> = {
  ARemporter: <BagIcon className="size-6" />,
  Livraison: <BikeIcon className="size-6" />,
  SurPlace: <TableIcon className="size-6" />,
}

export default function Checkout() {
  const { t } = useTranslation()
  const lang = useLang()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { data: cart, isPending, isError, error, refetch, isFetching } = usePanier()
  const { data: restaurant } = useRestaurant()
  const createOrder = useCreateOrder()
  const table = useTableSession()
  const formRef = useRef<HTMLFormElement>(null)
  const customer = useCustomerFeatures()
  const addressesQuery = useAddresses()
  const savedAddresses = addressesQuery.data ?? []

  const [chosenType, setChosenType] = useState<TypeCommande>(table ? 'SurPlace' : 'ARemporter')
  const [telephone, setTelephone] = useState(user?.telephone ?? '')
  const [note, setNote] = useState('')
  const [adresse, setAdresse] = useState('')
  // Adresse du carnet choisie ('other' = saisie libre, null = pas encore de choix).
  const [addressChoice, setAddressChoice] = useState<number | 'other' | null>(null)
  const [codeErrors, setCodeErrors] = useState<CheckoutFieldErrors>({})
  const [serverFields, setServerFields] = useState<Partial<Record<CheckoutField, string>>>({})
  const [failure, setFailure] = useState<OrderFailure | null>(null)

  const types = availableTypes(table !== null)
  const type: TypeCommande = types.includes(chosenType) ? chosenType : 'ARemporter'
  // Livraison : l'adresse par défaut est présélectionnée tant que le champ adresse est vide.
  if (
    type === 'Livraison' &&
    addressChoice === null &&
    savedAddresses.length > 0 &&
    adresse.trim() === ''
  ) {
    const preset = defaultAddress(savedAddresses)
    if (preset) {
      const prefill = checkoutPrefill(preset)
      setAddressChoice(preset.id)
      setAdresse(prefill.adresse)
      setTelephone(prefill.telephone)
    }
  }
  const chooseAddress = (choice: number | 'other') => {
    setAddressChoice(choice)
    clearField('adresseLivraison')
    if (choice === 'other') {
      setAdresse('')
      return
    }
    const picked = savedAddresses.find((a) => a.id === choice)
    if (picked) {
      const prefill = checkoutPrefill(picked)
      setAdresse(prefill.adresse)
      setTelephone(prefill.telephone)
      clearField('telephone')
    }
  }
  const hasLines = (cart?.lignes.length ?? 0) > 0
  const blocked = blockedLines(cart)
  const sousTotal = cart?.sousTotal ?? 0
  const delivery = deliveryInfo(sousTotal, restaurant)
  const preview = previewTotal(sousTotal, type, delivery.fee)
  const closed =
    restaurant !== undefined && (!restaurant.commandesOuvertes || !restaurant.ouvertMaintenant)
  const belowMinimum = type === 'Livraison' && delivery.belowMinimum

  const blocker =
    blocked.length > 0 ? 'unavailable' : closed ? 'closed' : belowMinimum ? 'minimum' : null

  const fieldError = (field: CheckoutField): string | undefined => {
    const code: CheckoutErrorCode | undefined = codeErrors[field]
    if (code) {
      return t(`checkout.errors.${code}`, {
        max: field === 'note' ? NOTE_MAX : ADDRESS_MAX,
        min: ADDRESS_MIN,
      })
    }
    return serverFields[field]
  }

  const clearField = (field: CheckoutField) => {
    setCodeErrors((c) => ({ ...c, [field]: undefined }))
    setServerFields((c) => ({ ...c, [field]: undefined }))
  }

  const focusFirst = (failed: Partial<Record<CheckoutField, unknown>>) => {
    const first = FIELD_ORDER.find((field) => failed[field])
    if (!first) return
    const name = first === 'tableCode' ? 'table' : first
    formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus()
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (createOrder.isPending || blocker) return
    setFailure(null)
    setServerFields({})
    const values = { type, telephone, note, adresse, tableCode: table?.code ?? null }
    const errors = validateCheckout(values)
    setCodeErrors(errors)
    if (Object.keys(errors).length > 0) {
      focusFirst(errors)
      return
    }
    try {
      const order = await createOrder.mutateAsync(buildOrderRequest(values))
      void navigate(`/commande/${order.id}/confirmation`, { replace: true })
    } catch (error) {
      if (!(error instanceof OrderError)) {
        setFailure({ kind: 'generic', fields: {} })
        return
      }
      setFailure(error.failure)
      setServerFields(error.failure.fields)
      if (error.failure.fields.tableCode) leaveTable()
      focusFirst(error.failure.fields)
      if (error.failure.kind === 'network' || error.failure.kind === 'server') {
        toast(t(`checkout.failure.${error.failure.kind}`), { variant: 'error' })
      }
    }
  }

  const typeText: Record<TypeCommande, string> = {
    ARemporter: t('checkout.typeDesc.ARemporter'),
    Livraison: t('checkout.typeDesc.Livraison', { fee: formatPrice(delivery.fee, lang) }),
    SurPlace: t('checkout.typeDesc.SurPlace', { number: table?.numero ?? '' }),
  }

  return (
    <>
      <Seo title={t('checkout.title')} noindex />
      <TableBanner />
      <PageHeader title={t('checkout.title')} subtitle={t('checkout.subtitle')} />

      <div className="container-page flex-1 py-8">
        {isPending && (
          <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-56 w-full rounded-lg" />
          </div>
        )}
        {isError && (
          <ErrorState
            error={error}
            onRetry={() => void refetch()}
            retrying={isFetching}
            message={t('cart.loadError')}
          />
        )}
        {cart && !hasLines && (
          <EmptyState
            icon={<BagIcon />}
            title={t('cart.empty')}
            description={t('cart.emptyText')}
            action={
              <Button to="/menu" icon={<ArrowIcon />}>
                {t('common.seeMenu')}
              </Button>
            }
          />
        )}

        {cart && hasLines && (
          <form
            ref={formRef}
            onSubmit={(event) => void onSubmit(event)}
            noValidate
            className="grid items-start gap-8 lg:grid-cols-[1fr_24rem]"
          >
            <div className="flex flex-col gap-6">
              {failure && (
                <Alert>
                  <p>{t(`checkout.failure.${failure.kind}`)}</p>
                  {failure.kind === 'empty' && (
                    <Link
                      to="/menu"
                      className="inline-flex min-h-11 items-center font-bold underline underline-offset-4"
                    >
                      {t('common.seeMenu')}
                    </Link>
                  )}
                  {(failure.kind === 'unavailable' || failure.kind === 'minimum') && (
                    <Link
                      to="/panier"
                      className="inline-flex min-h-11 items-center font-bold underline underline-offset-4"
                    >
                      {t('checkout.backToCart')}
                    </Link>
                  )}
                </Alert>
              )}

              <Section n={1} title={t('checkout.stepType')}>
                <div
                  role="radiogroup"
                  aria-labelledby="step-1"
                  className="grid gap-3 sm:grid-cols-3"
                >
                  {types.map((option) => (
                    <div key={option} className="relative">
                      <input
                        type="radio"
                        name="type"
                        id={`type-${option}`}
                        value={option}
                        checked={type === option}
                        onChange={() => setChosenType(option)}
                        className="peer sr-only"
                      />
                      <label
                        htmlFor={`type-${option}`}
                        className="flex h-full min-h-20 cursor-pointer items-center gap-3 rounded-lg border-[1.5px] border-sand-400 bg-white p-4 transition-[border-color,background-color,transform] duration-200 peer-checked:border-terracotta-600 peer-checked:bg-terracotta-100/50 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sidi-600 hover:border-ink-500 active:scale-[0.98] sm:flex-col sm:items-start"
                      >
                        <span className="text-terracotta-600">{TYPE_ICONS[option]}</span>
                        <span>
                          <span className="block font-semibold">{t(`order.type.${option}`)}</span>
                          <span className="block text-sm text-ink-700">{typeText[option]}</span>
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </Section>

              <Section n={2} title={t('checkout.stepContact')}>
                <div className="flex flex-col gap-5">
                  <Input
                    name="telephone"
                    type="tel"
                    label={t('order.phone')}
                    value={telephone}
                    onChange={(event) => {
                      setTelephone(event.target.value)
                      clearField('telephone')
                    }}
                    error={fieldError('telephone')}
                    autoComplete="tel"
                    inputMode="tel"
                    ltr
                    required
                  />
                  <Field
                    label={t('order.note')}
                    optional
                    hint={t('checkout.counter', { count: note.length, max: NOTE_MAX })}
                    error={fieldError('note')}
                  >
                    {(c) => (
                      <textarea
                        name="note"
                        rows={3}
                        value={note}
                        onChange={(event) => {
                          setNote(event.target.value)
                          clearField('note')
                        }}
                        placeholder={t('checkout.notePlaceholder')}
                        className={cn(
                          control,
                          c['aria-invalid'] ? 'border-danger-600' : 'border-sand-400',
                        )}
                        {...c}
                      />
                    )}
                  </Field>
                </div>
              </Section>

              {type === 'Livraison' && (
                <Section n={3} title={t('checkout.stepDelivery')}>
                  <div className="flex flex-col gap-5">
                    {customer && (
                      <fieldset>
                        <legend className="mb-2 text-sm font-semibold text-ink-800">
                          {t('addresses.checkoutTitle')}
                        </legend>
                        {addressesQuery.isPending && (
                          <p role="status" className="text-sm text-ink-500">
                            {t('addresses.checkoutLoading')}
                          </p>
                        )}
                        {addressesQuery.isError && (
                          <p role="status" className="text-sm text-ink-500">
                            {t('addresses.checkoutUnavailable')}
                          </p>
                        )}
                        {savedAddresses.length > 0 && (
                          <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                            {[
                              ...savedAddresses.map((a) => ({
                                id: a.id as number | 'other',
                                address: a,
                              })),
                              { id: 'other' as const, address: null },
                            ].map(({ id, address }) => (
                              <div key={String(id)} className="relative">
                                <input
                                  type="radio"
                                  name="savedAddress"
                                  id={`saved-${id}`}
                                  checked={addressChoice === id}
                                  onChange={() => chooseAddress(id)}
                                  className="peer sr-only"
                                />
                                <label
                                  htmlFor={`saved-${id}`}
                                  className="flex h-full min-h-14 cursor-pointer flex-col justify-center rounded-lg border-[1.5px] border-sand-400 bg-white p-3 text-sm transition-colors peer-checked:border-terracotta-600 peer-checked:bg-terracotta-100/50 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sidi-600 hover:border-ink-500"
                                >
                                  {address ? (
                                    <>
                                      <span className="font-semibold">
                                        {address.libelle}
                                        {address.estParDefaut && (
                                          <span className="ms-2 text-xs font-normal text-olive-700">
                                            ({t('addresses.default')})
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-ink-700">
                                        {address.ligne}, {address.ville}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="font-semibold">{t('addresses.other')}</span>
                                  )}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </fieldset>
                    )}
                    <Field
                      label={t('order.address')}
                      required
                      hint={t('checkout.addressHint', {
                        min: ADDRESS_MIN,
                        max: ADDRESS_MAX,
                        count: adresse.trim().length,
                      })}
                      error={fieldError('adresseLivraison')}
                    >
                      {(c) => (
                        <textarea
                          name="adresseLivraison"
                          rows={3}
                          value={adresse}
                          onChange={(event) => {
                            setAdresse(event.target.value)
                            clearField('adresseLivraison')
                          }}
                          autoComplete="street-address"
                          className={cn(
                            control,
                            c['aria-invalid'] ? 'border-danger-600' : 'border-sand-400',
                          )}
                          {...c}
                        />
                      )}
                    </Field>
                    <p className="text-sm text-ink-700">
                      {t('checkout.deliveryInfo', {
                        fee: formatPrice(delivery.fee, lang),
                        minimum: formatPrice(delivery.minimum, lang),
                      })}
                    </p>
                    {belowMinimum && (
                      <Alert tone="warning">
                        <p>
                          {t('checkout.belowMinimum', {
                            missing: formatPrice(delivery.missing, lang),
                          })}
                        </p>
                        <Link
                          to="/menu"
                          className="inline-flex min-h-11 items-center font-bold underline underline-offset-4"
                        >
                          {t('checkout.addMore')}
                        </Link>
                      </Alert>
                    )}
                  </div>
                </Section>
              )}

              {type === 'SurPlace' && table && (
                <Section n={3} title={t('checkout.stepTable')}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-display text-2xl font-semibold">
                      {t('table.number', { number: table.numero })}
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={leaveTable}>
                      {t('table.leave')}
                    </Button>
                  </div>
                  {fieldError('tableCode') && (
                    <p role="alert" className="mt-3 text-sm font-medium text-danger-600">
                      {fieldError('tableCode')}
                    </p>
                  )}
                </Section>
              )}
            </div>

            <aside className="lg:sticky lg:top-28" aria-labelledby="summary-title">
              <div className="rounded-lg bg-white p-5 shadow-soft sm:p-6">
                <h2 id="summary-title" className="text-xl sm:text-2xl">
                  {t('checkout.summary')}
                </h2>
                <ul className="mt-4 flex flex-col divide-y divide-sand-200 text-sm">
                  {cart.lignes.map((line) => (
                    <li
                      key={line.articleId}
                      className="flex items-baseline justify-between gap-3 py-2"
                    >
                      <span>
                        <span className="tabular font-semibold">{line.quantite} ×</span> {line.nom}
                      </span>
                      <span className="tabular shrink-0">{formatPrice(line.totalLigne, lang)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-4 flex flex-col gap-2 border-t border-sand-300 pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt>{t('cart.subtotal')}</dt>
                    <dd className="tabular">{formatPrice(sousTotal, lang)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>{t('cart.delivery')}</dt>
                    <dd className="tabular">
                      {preview.frais > 0 ? formatPrice(preview.frais, lang) : t('common.free')}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-sand-300 pt-3">
                    <dt className="font-semibold">{t('cart.total')}</dt>
                    <dd className="tabular font-display text-2xl font-bold text-terracotta-700">
                      {formatPrice(preview.total, lang)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-ink-500">{t('checkout.previewNote')}</p>
                <p className="mt-4 rounded-md bg-sand-100 p-3 text-sm">
                  <span className="font-semibold">{t('checkout.payment')}</span>{' '}
                  {t('checkout.cash')}
                </p>

                {blocker && (
                  <p
                    id="submit-blocker"
                    className="mt-4 flex items-start gap-2 text-sm font-medium text-danger-800"
                  >
                    <AlertIcon className="mt-0.5 size-4 shrink-0" />
                    {t(`checkout.blocker.${blocker}`)}
                  </p>
                )}
                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  className="mt-4"
                  loading={createOrder.isPending}
                  aria-disabled={blocker ? true : undefined}
                  aria-describedby={blocker ? 'submit-blocker' : undefined}
                >
                  {createOrder.isPending ? t('checkout.sending') : t('checkout.confirm')}
                </Button>
              </div>
            </aside>
          </form>
        )}
      </div>
    </>
  )
}
