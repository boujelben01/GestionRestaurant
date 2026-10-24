import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  ArrowIcon,
  BagIcon,
  Button,
  EmptyState,
  ErrorState,
  Reveal,
  Skeleton,
} from '@/components/ui'
import { useOrders } from '@/features/orders/api'
import { OrderStatusBadge } from '@/features/orders/OrderStatusBadge'
import { formatDateTime, formatPrice } from '@/lib/format'
import { useLang } from '@/lib/useLang'

function OrdersSkeleton() {
  const { t } = useTranslation()
  return (
    <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-28 w-full rounded-lg" />
      ))}
    </div>
  )
}

export default function Orders() {
  const { t } = useTranslation()
  const lang = useLang()
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useOrders()
  const orders = data?.pages.flatMap((page) => page.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  return (
    <>
      <Seo title={t('orders.title')} noindex />
      <PageHeader title={t('orders.title')} subtitle={t('orders.subtitle')} />
      <div className="container-page flex-1 py-8">
        {isPending && <OrdersSkeleton />}
        {isError && (
          <ErrorState
            error={error}
            message={t('orders.loadError')}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        )}
        {data && orders.length === 0 && (
          <EmptyState
            icon={<BagIcon />}
            title={t('orders.emptyTitle')}
            description={t('orders.emptyText')}
            action={
              <Button to="/menu" icon={<ArrowIcon />}>
                {t('common.seeMenu')}
              </Button>
            }
          />
        )}
        {orders.length > 0 && (
          <>
            <ul className="flex flex-col gap-4">
              {orders.map((order, index) => (
                <Reveal as="li" key={order.id} index={index % 6}>
                  <Link
                    to={`/commandes/${order.id}`}
                    className="group relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg bg-white p-5 shadow-soft transition-transform duration-300 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:opacity-0 after:shadow-lift after:transition-opacity after:duration-300 hover:-translate-y-0.5 hover:after:opacity-100"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span dir="ltr" className="tabular font-display text-xl font-bold">
                          {order.numero}
                        </span>
                        <OrderStatusBadge statut={order.statut} />
                      </div>
                      <p className="text-sm text-ink-700">
                        {t(`order.type.${order.typeCommande}`)} ·{' '}
                        {t('cart.itemCount', { count: order.nombreArticles })}
                      </p>
                      <p className="tabular text-sm text-ink-500">
                        {formatDateTime(order.dateCommande, lang)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular font-display text-2xl font-bold text-terracotta-700">
                        {formatPrice(order.total, lang)}
                      </span>
                      <span className="sr-only">{t('orders.view')}</span>
                      <ArrowIcon className="size-5 text-ink-500 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                    </div>
                  </Link>
                </Reveal>
              ))}
            </ul>

            <div className="mt-8 flex flex-col items-center gap-3">
              <p role="status" aria-live="polite" className="text-sm text-ink-700">
                {t('orders.loaded', { count: orders.length, total })}
              </p>
              {hasNextPage && (
                <Button
                  variant="outline"
                  loading={isFetchingNextPage}
                  onClick={() => void fetchNextPage()}
                >
                  {t('orders.loadMore')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
