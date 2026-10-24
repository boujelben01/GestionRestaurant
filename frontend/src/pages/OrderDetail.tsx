import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  AlertIcon,
  ArrowIcon,
  BagIcon,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Skeleton,
  useToast,
} from '@/components/ui'
import { useCancelOrder, useOrder, useReorder } from '@/features/orders/api'
import { OrderStatusBadge } from '@/features/orders/OrderStatusBadge'
import { OrderTimeline } from '@/features/orders/OrderTimeline'
import { canCancel, isFinalStatus } from '@/features/orders/status'
import type { ReorderResult } from '@/features/orders/reorder'
import { toAppError } from '@/lib/errors'
import { formatDateTime, formatPrice } from '@/lib/format'
import type { StatutCommande } from '@/lib/types'
import { useLang } from '@/lib/useLang'

function DetailSkeleton() {
  const { t } = useTranslation()
  return (
    <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-4">
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
}

function BackLink() {
  const { t } = useTranslation()
  return (
    <Link
      to="/commandes"
      className="inline-flex min-h-11 items-center gap-2 font-semibold text-sidi-700 underline-offset-4 hover:underline"
    >
      <ArrowIcon className="size-4 rotate-180" />
      {t('orderDetail.back')}
    </Link>
  )
}

export default function OrderDetail() {
  const { t } = useTranslation()
  const lang = useLang()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { id } = useParams()
  const orderId = Number(id)
  const { data: order, error, isPending, refetch, isFetching } = useOrder(orderId)
  const cancel = useCancelOrder()
  const reorder = useReorder()

  const [confirmCancel, setConfirmCancel] = useState(false)
  const [reorderResult, setReorderResult] = useState<ReorderResult | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [lastStatus, setLastStatus] = useState<StatutCommande | undefined>(order?.statut)

  // Annonce un changement de statut (jamais au premier affichage) : ajustement d'état pendant le rendu.
  if (order && order.statut !== lastStatus) {
    if (lastStatus !== undefined) {
      setAnnouncement(t('orderDetail.statusChanged', { status: t(`order.status.${order.statut}`) }))
    }
    setLastStatus(order.statut)
  }

  const notFound = !Number.isFinite(orderId) || (error !== null && toAppError(error).status === 404)

  const doCancel = () => {
    setConfirmCancel(false)
    cancel.mutate(orderId, {
      onSuccess: () => toast(t('orderDetail.cancelled'), { variant: 'success' }),
      onError: (e) => {
        const status = toAppError(e).status
        toast(status === 409 ? t('orderDetail.cancelConflict') : t('errors.generic'), {
          variant: status === 409 ? 'info' : 'error',
        })
      },
    })
  }

  const doReorder = () => {
    if (!order) return
    reorder.mutate(order, {
      onSuccess: (result) => {
        if (result.skipped.length === 0 && result.added.length > 0) {
          toast(t('orderDetail.reorderDone'), {
            variant: 'success',
            action: { label: t('cart.view'), onClick: () => void navigate('/panier') },
          })
        } else {
          setReorderResult(result)
        }
      },
      onError: () => toast(t('errors.generic'), { variant: 'error' }),
    })
  }

  if (notFound) {
    return (
      <>
        <Seo title={t('orderDetail.notFoundTitle')} noindex />
        <div className="container-page flex-1 py-16">
          <EmptyState
            icon={<BagIcon />}
            title={t('orderDetail.notFoundTitle')}
            description={t('orderDetail.notFoundText')}
            action={<Button to="/commandes">{t('orderDetail.back')}</Button>}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <Seo title={order ? order.numero : t('orders.title')} noindex />
      <PageHeader title={order ? order.numero : t('orders.title')}>
        <div className="flex flex-wrap items-center gap-3">
          {order && <OrderStatusBadge statut={order.statut} />}
          {order && (
            <span className="tabular text-sm text-ink-700">
              {formatDateTime(order.dateCommande, lang)}
            </span>
          )}
        </div>
      </PageHeader>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="container-page flex-1 py-8">
        <div className="mb-6">
          <BackLink />
        </div>

        {isPending && <DetailSkeleton />}
        {error && !order && (
          <ErrorState
            error={error}
            message={t('orderDetail.loadError')}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        )}

        {order && (
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
            <div className="flex flex-col gap-6">
              <Card className="p-5 sm:p-6">
                <h2 className="mb-5 text-xl sm:text-2xl">{t('orderDetail.tracking')}</h2>
                <OrderTimeline statut={order.statut} historique={order.historique} />
                {!isFinalStatus(order.statut) && (
                  <p className="mt-6 flex items-center gap-2 text-xs text-ink-500">
                    <span
                      aria-hidden="true"
                      className="size-2 animate-pulse-soft rounded-full bg-olive-500"
                    />
                    {t('orderDetail.autoUpdate')}
                  </p>
                )}
              </Card>

              <Card className="p-5 sm:p-6">
                <h2 className="mb-4 text-xl sm:text-2xl">{t('orderDetail.items')}</h2>
                <ul className="flex flex-col divide-y divide-sand-200">
                  {order.lignes.map((line, index) => (
                    <li key={index} className="flex items-baseline justify-between gap-4 py-3">
                      <div>
                        <p className="font-semibold">{lang === 'ar' ? line.nomAr : line.nomFr}</p>
                        <p className="tabular text-sm text-ink-500">
                          {line.quantite} × {formatPrice(line.prixUnitaire, lang)}
                        </p>
                      </div>
                      <p className="tabular shrink-0 font-semibold">
                        {formatPrice(line.totalLigne, lang)}
                      </p>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 flex flex-col gap-2 border-t border-sand-300 pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt>{t('cart.subtotal')}</dt>
                    <dd className="tabular">{formatPrice(order.sousTotal, lang)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>{t('cart.delivery')}</dt>
                    <dd className="tabular">
                      {order.fraisLivraison > 0
                        ? formatPrice(order.fraisLivraison, lang)
                        : t('common.free')}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-sand-300 pt-3">
                    <dt className="font-semibold">{t('cart.total')}</dt>
                    <dd className="tabular font-display text-2xl font-bold text-terracotta-700">
                      {formatPrice(order.total, lang)}
                    </dd>
                  </div>
                </dl>
              </Card>
            </div>

            <aside className="flex flex-col gap-6 lg:sticky lg:top-28">
              <Card className="p-5 sm:p-6">
                <h2 className="mb-4 text-xl sm:text-2xl">{t('orderDetail.info')}</h2>
                <dl className="flex flex-col gap-3 text-sm">
                  <div>
                    <dt className="font-semibold">{t('confirmation.type')}</dt>
                    <dd>{t(`order.type.${order.typeCommande}`)}</dd>
                  </div>
                  {order.tableNumero !== null && (
                    <div>
                      <dt className="font-semibold">{t('confirmation.table')}</dt>
                      <dd>{t('table.number', { number: order.tableNumero })}</dd>
                    </div>
                  )}
                  {order.adresseLivraison && (
                    <div>
                      <dt className="font-semibold">{t('order.address')}</dt>
                      <dd>{order.adresseLivraison}</dd>
                    </div>
                  )}
                  {order.note && (
                    <div>
                      <dt className="font-semibold">{t('order.note')}</dt>
                      <dd className="break-words">{order.note}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-semibold">{t('checkout.payment')}</dt>
                    <dd>
                      {t('checkout.cash')}
                      <span className="block text-ink-500">
                        {order.estPayee ? t('orderDetail.paid') : t('orderDetail.payOnReceipt')}
                      </span>
                    </dd>
                  </div>
                </dl>
              </Card>

              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  fullWidth
                  loading={reorder.isPending}
                  onClick={doReorder}
                  icon={<BagIcon />}
                >
                  {t('orderDetail.reorder')}
                </Button>
                {canCancel(order.statut) && (
                  <Button
                    variant="outline"
                    fullWidth
                    loading={cancel.isPending}
                    onClick={() => setConfirmCancel(true)}
                  >
                    {t('orderDetail.cancel')}
                  </Button>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>

      <Dialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={t('orderDetail.cancelTitle')}
        description={t('orderDetail.cancelText')}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              {t('orderDetail.keep')}
            </Button>
            <Button variant="danger" onClick={doCancel}>
              {t('orderDetail.cancelConfirm')}
            </Button>
          </>
        }
      />

      <Dialog
        open={reorderResult !== null}
        onClose={() => setReorderResult(null)}
        title={t('orderDetail.reorderTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setReorderResult(null)}>
              {t('common.close')}
            </Button>
            {reorderResult && reorderResult.added.length > 0 && (
              <Button
                onClick={() => {
                  setReorderResult(null)
                  void navigate('/panier')
                }}
              >
                {t('cart.view')}
              </Button>
            )}
          </>
        }
      >
        {reorderResult && (
          <div className="flex flex-col gap-4 text-sm">
            {reorderResult.added.length > 0 && (
              <section>
                <h3 className="mb-2 font-semibold text-olive-700">{t('orderDetail.added')}</h3>
                <ul className="list-disc ps-5">
                  {reorderResult.added.map((item, index) => (
                    <li key={index}>
                      {item.quantite} × {item.nom}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {reorderResult.skipped.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 font-semibold text-danger-800">
                  <AlertIcon className="size-4" />
                  {t('orderDetail.skipped')}
                </h3>
                <ul className="list-disc ps-5">
                  {reorderResult.skipped.map((item, index) => (
                    <li key={index}>
                      {item.nom} : {t(`orderDetail.reason.${item.reason}`)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </Dialog>
    </>
  )
}
