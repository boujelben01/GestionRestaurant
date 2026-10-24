import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  BagIcon,
  Pagination,
  SelectField,
  Skeleton,
} from '@/components/ui'
import { OrderStatusBadge } from '@/features/orders/OrderStatusBadge'
import { cn } from '@/lib/cn'
import { formatDateTime, formatPrice } from '@/lib/format'
import type { AdminOrderSummary, StatutCommande, TypeCommande } from '@/lib/types'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { useLang } from '@/lib/useLang'
import { EMPTY_FILTERS, useAdminOrders, type OrderFilters } from './api'
import { OrderDetailDialog } from './OrderDetailDialog'

const PAGE_SIZE = 20
const STATUSES: StatutCommande[] = ['EnAttente', 'EnPreparation', 'Prete', 'Terminee', 'Annulee']
const TYPES: TypeCommande[] = ['SurPlace', 'ARemporter', 'Livraison']

export function OrderHistory() {
  const { t } = useTranslation()
  const lang = useLang()
  const [filters, setFilters] = useState<OrderFilters>(EMPTY_FILTERS)
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<AdminOrderSummary | null>(null)

  const debouncedSearch = useDebouncedValue(searchText, 300)
  const effective = { ...filters, recherche: debouncedSearch }
  const { data, isPending, isError, error, refetch, isFetching } = useAdminOrders(
    effective,
    page,
    PAGE_SIZE,
  )

  const update = (patch: Partial<OrderFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(1)
  }
  const toggleStatus = (status: StatutCommande) =>
    update({
      statut: filters.statut.includes(status)
        ? filters.statut.filter((s) => s !== status)
        : [...filters.statut, status],
    })
  const reset = () => {
    setFilters(EMPTY_FILTERS)
    setSearchText('')
    setPage(1)
  }
  const dirty =
    filters.statut.length > 0 ||
    filters.typeCommande !== '' ||
    filters.estPayee !== null ||
    filters.du !== '' ||
    filters.au !== '' ||
    searchText !== ''

  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const typeLabel = (o: AdminOrderSummary) =>
    o.typeCommande === 'SurPlace' && o.tableNumero !== null
      ? t('table.number', { number: o.tableNumero })
      : t(`order.type.${o.typeCommande}`)

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={(event) => event.preventDefault()}
        aria-label={t('admin.orders.filters')}
        className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow-soft"
      >
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t('admin.orders.filterStatus')}</legend>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((status) => {
              const on = filters.statut.includes(status)
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleStatus(status)}
                  className={cn(
                    'min-h-11 rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors',
                    on
                      ? 'border-ink-900 bg-ink-900 text-sand-50'
                      : 'border-sand-400 bg-white text-ink-700 hover:border-ink-500',
                  )}
                >
                  {t(`order.status.${status}`)}
                </button>
              )
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SelectField
            label={t('admin.orders.filterType')}
            value={filters.typeCommande}
            onChange={(event) => update({ typeCommande: event.target.value as TypeCommande | '' })}
          >
            <option value="">{t('admin.common.all')}</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`order.type.${type}`)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('admin.orders.filterPaid')}
            value={filters.estPayee === null ? '' : String(filters.estPayee)}
            onChange={(event) =>
              update({ estPayee: event.target.value === '' ? null : event.target.value === 'true' })
            }
          >
            <option value="">{t('admin.common.all')}</option>
            <option value="true">{t('admin.orders.paid')}</option>
            <option value="false">{t('admin.orders.unpaid')}</option>
          </SelectField>
          <Input
            type="date"
            label={t('admin.orders.filterFrom')}
            value={filters.du}
            onChange={(event) => update({ du: event.target.value })}
            max={filters.au || undefined}
            ltr
          />
          <Input
            type="date"
            label={t('admin.orders.filterTo')}
            value={filters.au}
            onChange={(event) => update({ au: event.target.value })}
            min={filters.du || undefined}
            ltr
          />
          <Input
            type="search"
            label={t('admin.orders.filterSearch')}
            placeholder={t('admin.orders.searchPlaceholder')}
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
          <Button variant="ghost" size="sm" onClick={reset} disabled={!dirty}>
            {t('admin.common.resetFilters')}
          </Button>
        </div>
      </form>

      {isPending && (
        <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} />}
      {data && data.items.length === 0 && (
        <EmptyState
          icon={<BagIcon />}
          title={t('admin.orders.historyEmpty')}
          action={
            dirty ? (
              <Button variant="outline" size="sm" onClick={reset}>
                {t('admin.common.resetFilters')}
              </Button>
            ) : undefined
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          {/* Cartes (mobile) */}
          <ul className="flex flex-col gap-3 md:hidden">
            {data.items.map((order) => (
              <li key={order.id} className="rounded-lg bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setDetail(order)}
                    className="min-h-11 font-display text-lg font-bold underline-offset-4 hover:underline"
                  >
                    <span dir="ltr">{order.numero}</span>
                  </button>
                  <OrderStatusBadge statut={order.statut} />
                </div>
                <p className="tabular text-sm text-ink-500">
                  {formatDateTime(order.dateCommande, lang)}
                </p>
                <p className="mt-1 text-sm">
                  {order.nomClient} · {typeLabel(order)}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="tabular font-bold text-terracotta-700">
                    {formatPrice(order.total, lang)}
                  </span>
                  <Badge tone={order.estPayee ? 'olive' : 'gold'}>
                    {order.estPayee ? t('admin.orders.paid') : t('admin.orders.unpaid')}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>

          {/* Tableau (md+) */}
          <div className="hidden overflow-x-auto rounded-lg bg-white shadow-soft md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('admin.orders.history')}</caption>
              <thead className="bg-sand-100 text-start text-xs tracking-wide uppercase">
                <tr>
                  {['number', 'date', 'customer', 'type', 'total', 'payment', 'status'].map(
                    (col) => (
                      <th key={col} scope="col" className="px-4 py-3 text-start font-semibold">
                        {t(`admin.orders.col.${col}`)}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {data.items.map((order) => (
                  <tr key={order.id} className="hover:bg-sand-50">
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setDetail(order)}
                        className="min-h-11 font-bold underline-offset-4 hover:underline"
                      >
                        <span dir="ltr">{order.numero}</span>
                      </button>
                    </td>
                    <td className="tabular px-4 py-2 whitespace-nowrap">
                      {formatDateTime(order.dateCommande, lang)}
                    </td>
                    <td className="px-4 py-2">
                      {order.nomClient}
                      <bdi dir="ltr" className="tabular block text-ink-500">
                        {order.telephone}
                      </bdi>
                    </td>
                    <td className="px-4 py-2">{typeLabel(order)}</td>
                    <td className="tabular px-4 py-2 font-semibold">
                      {formatPrice(order.total, lang)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={order.estPayee ? 'olive' : 'gold'}>
                        {order.estPayee ? t('admin.orders.paid') : t('admin.orders.unpaid')}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <OrderStatusBadge statut={order.statut} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pageCount={pageCount} onPage={setPage} busy={isFetching} />
        </>
      )}

      <OrderDetailDialog order={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
