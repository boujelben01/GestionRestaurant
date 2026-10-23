import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import {
  ArrowIcon,
  Button,
  Card,
  CheckIcon,
  ErrorState,
  Skeleton,
  ZelligePattern,
} from '@/components/ui'
import { useOrder } from '@/features/orders/api'
import { toAppError } from '@/lib/errors'
import { formatPrice } from '@/lib/format'
import { useLang } from '@/lib/useLang'

function SuccessMark() {
  return (
    <div className="relative mx-auto mb-6 grid size-24 place-items-center">
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-olive-100"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.span
        aria-hidden="true"
        className="relative grid size-14 place-items-center rounded-full bg-olive-700 text-white"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.15 }}
      >
        <CheckIcon className="size-8" strokeWidth={2.4} />
      </motion.span>
    </div>
  )
}

export default function OrderConfirmation() {
  const { t } = useTranslation()
  const lang = useLang()
  const { id } = useParams()
  const orderId = Number(id)
  const { data: order, isPending, error, refetch, isFetching } = useOrder(orderId)
  const notFound = !Number.isFinite(orderId) || (error !== null && toAppError(error).status === 404)

  return (
    <section className="relative isolate flex flex-1 flex-col overflow-hidden">
      <Seo title={t('confirmation.title')} noindex />
      <ZelligePattern className="-z-10 text-terracotta-600 opacity-[0.06]" size={72} />
      <div className="container-page w-full max-w-2xl py-12 sm:py-16">
        {isPending && !notFound && (
          <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-4">
            <Skeleton className="mx-auto size-24 rounded-full" />
            <Skeleton className="mx-auto h-10 w-2/3" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        )}

        {notFound && (
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl">{t('confirmation.notFoundTitle')}</h1>
            <p className="mt-3 text-ink-700">{t('confirmation.notFoundText')}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button to="/commandes">{t('nav.orders')}</Button>
              <Button to="/menu" variant="outline">
                {t('common.seeMenu')}
              </Button>
            </div>
          </div>
        )}

        {!notFound && error && !order && (
          <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
        )}

        {order && (
          <>
            <div className="text-center">
              <SuccessMark />
              <h1 className="text-3xl sm:text-4xl">{t('confirmation.heading')}</h1>
              <p className="mt-3 text-ink-700">{t('confirmation.waiting')}</p>
              <p className="text-eyebrow mt-6 text-ink-500">{t('confirmation.numberLabel')}</p>
              <p
                dir="ltr"
                className="tabular mt-1 font-display text-4xl font-bold tracking-wide text-terracotta-700 sm:text-5xl"
              >
                {order.numero}
              </p>
            </div>

            <Card className="mt-10 p-5 sm:p-6">
              <ul className="flex flex-col divide-y divide-sand-200">
                {order.lignes.map((line, index) => (
                  <li key={index} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span>
                      <span className="tabular font-semibold">{line.quantite} ×</span>{' '}
                      {lang === 'ar' ? line.nomAr : line.nomFr}
                    </span>
                    <span className="tabular shrink-0">{formatPrice(line.totalLigne, lang)}</span>
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
              <dl className="mt-5 grid gap-3 rounded-md bg-sand-100 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold">{t('confirmation.type')}</dt>
                  <dd>{t(`order.type.${order.typeCommande}`)}</dd>
                </div>
                <div>
                  <dt className="font-semibold">{t('checkout.payment')}</dt>
                  <dd>{t('checkout.cash')}</dd>
                </div>
                {order.tableNumero !== null && (
                  <div>
                    <dt className="font-semibold">{t('confirmation.table')}</dt>
                    <dd>{t('table.number', { number: order.tableNumero })}</dd>
                  </div>
                )}
                {order.adresseLivraison && (
                  <div className="sm:col-span-2">
                    <dt className="font-semibold">{t('order.address')}</dt>
                    <dd>{order.adresseLivraison}</dd>
                  </div>
                )}
              </dl>
            </Card>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to={`/commandes/${order.id}`}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-terracotta-600 px-8 font-semibold text-white shadow-soft transition-colors hover:bg-terracotta-700"
              >
                {t('confirmation.track')}
                <ArrowIcon />
              </Link>
              <Button to="/menu" variant="outline" size="lg">
                {t('confirmation.backToMenu')}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
