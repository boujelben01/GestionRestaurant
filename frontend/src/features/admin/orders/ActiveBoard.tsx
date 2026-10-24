import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup } from 'motion/react'
import { useTranslation } from 'react-i18next'
import {
  AlertIcon,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  BagIcon,
  Skeleton,
  Tabs,
  panelId,
  useToast,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import type { ActiveOrder, StatutCommande } from '@/lib/types'
import { adminErrorMessage } from '../adminErrors'
import { useActiveOrders, useChangeOrderStatus, useOrderCounters, useSetOrderPaid } from './api'
import { useAlertSound } from './alertSound'
import { useNewOrderTracker } from './newOrders'
import { OrderCard } from './OrderCard'
import { OrderDetailDialog } from './OrderDetailDialog'
import { SoundControl } from './SoundControl'
import { BOARD_STATUSES, type BoardStatus } from './transitions'
import { useNow } from './useNow'

const columnTone: Record<BoardStatus, string> = {
  EnAttente: 'border-gold-400',
  EnPreparation: 'border-sidi-500',
  Prete: 'border-terracotta-500',
}

export function ActiveBoard() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { data: orders, isPending, isError, error, refetch, isFetching } = useActiveOrders()
  const { data: counters } = useOrderCounters()
  const changeStatus = useChangeOrderStatus()
  const setPaid = useSetOrderPaid()
  const sound = useAlertSound()
  const now = useNow()

  const [mobileTab, setMobileTab] = useState<BoardStatus>('EnAttente')
  const [busy, setBusy] = useState<ReadonlySet<number>>(new Set())
  const [cancelTarget, setCancelTarget] = useState<ActiveOrder | null>(null)
  const [detail, setDetail] = useState<ActiveOrder | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const markBusy = (id: number, on: boolean) =>
    setBusy((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  // Le suivi des nouvelles commandes s'appuie sur les numéros du dernier relevé.
  const ordersRef = useRef(orders)
  useEffect(() => {
    ordersRef.current = orders
  })
  const { newIds, newCount, dismiss } = useNewOrderTracker(orders, {
    onNew: (ids) => {
      sound.play()
      const numeros = (ordersRef.current ?? [])
        .filter((o) => ids.includes(o.id))
        .map((o) => o.numero)
        .join(', ')
      setAnnouncement(t('admin.orders.newAnnounce', { numero: numeros, count: ids.length }))
      toast(t('admin.orders.newAnnounce', { numero: numeros, count: ids.length }), {
        variant: 'info',
      })
    },
  })

  const byStatus = useMemo(() => {
    const groups: Record<BoardStatus, ActiveOrder[]> = {
      EnAttente: [],
      EnPreparation: [],
      Prete: [],
    }
    for (const order of orders ?? []) {
      if (order.statut in groups) groups[order.statut as BoardStatus].push(order)
    }
    for (const list of Object.values(groups)) {
      list.sort((a, b) => a.dateCommande.localeCompare(b.dateCommande))
    }
    return groups
  }, [orders])

  const changeTo = (order: ActiveOrder, statut: StatutCommande) => {
    markBusy(order.id, true)
    changeStatus.mutate(
      { order: { id: order.id, version: order.version }, statut },
      {
        onSuccess: () =>
          setAnnouncement(
            t('admin.orders.statusAnnounce', {
              numero: order.numero,
              status: t(`order.status.${statut}`),
            }),
          ),
        onError: (error) =>
          toast(adminErrorMessage(error, t, 'admin.orders.errors.conflict'), { variant: 'error' }),
        onSettled: () => markBusy(order.id, false),
      },
    )
  }

  const togglePaid = (order: ActiveOrder, estPayee: boolean) => {
    markBusy(order.id, true)
    setPaid.mutate(
      { id: order.id, estPayee },
      {
        onError: (error) =>
          toast(adminErrorMessage(error, t, 'admin.orders.errors.conflict'), { variant: 'error' }),
        onSettled: () => markBusy(order.id, false),
      },
    )
  }

  const doCancel = () => {
    if (!cancelTarget) return
    const target = cancelTarget
    setCancelTarget(null)
    changeTo(target, 'Annulee')
  }

  const tabs = BOARD_STATUSES.map((status) => ({
    id: status,
    label: t(`order.status.${status}`),
    count: byStatus[status].length,
  }))

  const todayCount = counters?.totalAujourdhui

  return (
    <div className="flex flex-col gap-5">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {todayCount !== undefined && (
            <p className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-soft">
              {t('admin.orders.today', { count: todayCount })}
            </p>
          )}
          {counters?.parStatut.map((entry) => (
            <span
              key={entry.statut}
              className="tabular rounded-full bg-sand-200 px-3 py-1.5 text-xs font-semibold text-ink-700"
            >
              {t(`order.status.${entry.statut}`)} · {entry.nombre}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {newCount > 0 && (
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-terracotta-600 px-4 text-sm font-bold text-white shadow-soft transition-colors hover:bg-terracotta-700"
            >
              {t('admin.orders.newCount', { count: newCount })}
              <span className="text-xs font-normal opacity-90">{t('admin.orders.dismiss')}</span>
            </button>
          )}
          <SoundControl sound={sound} />
        </div>
      </div>

      {isError && orders && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gold-800/30 bg-gold-100 p-3 text-sm font-medium text-gold-800"
        >
          <span className="flex items-center gap-2">
            <AlertIcon className="size-5" />
            {t('admin.orders.connectionLost')}
          </span>
          <Button size="sm" variant="outline" loading={isFetching} onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {isPending && (
        <div role="status" aria-label={t('common.loading')} className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-lg" />
          ))}
        </div>
      )}
      {isError && !orders && (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} />
      )}

      {orders && (
        <>
          <Tabs
            tabs={tabs}
            value={mobileTab}
            onChange={setMobileTab}
            label={t('admin.orders.statusTabs')}
            idPrefix="board"
            className="lg:hidden"
          />
          <LayoutGroup>
            <div className="grid items-start gap-5 lg:grid-cols-3">
              {BOARD_STATUSES.map((status) => {
                const list = byStatus[status]
                return (
                  <section
                    key={status}
                    id={panelId('board', status)}
                    role="tabpanel"
                    aria-labelledby={`board-tab-${status}`}
                    aria-label={`${t(`order.status.${status}`)} (${list.length})`}
                    className={cn(
                      mobileTab === status ? 'flex' : 'hidden lg:flex',
                      'flex-col gap-3',
                    )}
                  >
                    <h2
                      className={cn(
                        'hidden items-center justify-between rounded-md border-s-4 bg-white px-4 py-2 text-lg lg:flex',
                        columnTone[status],
                      )}
                    >
                      {t(`order.status.${status}`)}
                      <span className="tabular rounded-full bg-sand-200 px-2.5 text-sm font-bold">
                        {list.length}
                      </span>
                    </h2>
                    {list.length === 0 ? (
                      <EmptyState
                        compact
                        icon={<BagIcon />}
                        title={t('admin.orders.emptyColumn')}
                      />
                    ) : (
                      <ul className="flex flex-col gap-3">
                        <AnimatePresence initial={false}>
                          {list.map((order) => (
                            <OrderCard
                              key={order.id}
                              order={order}
                              isNew={newIds.has(order.id)}
                              now={now}
                              busy={busy.has(order.id)}
                              onOpen={setDetail}
                              onStatus={changeTo}
                              onCancel={setCancelTarget}
                              onPaid={togglePaid}
                            />
                          ))}
                        </AnimatePresence>
                      </ul>
                    )}
                  </section>
                )
              })}
            </div>
          </LayoutGroup>
        </>
      )}

      <OrderDetailDialog order={detail} onClose={() => setDetail(null)} />

      <Dialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title={t('admin.orders.cancelTitle', { numero: cancelTarget?.numero ?? '' })}
        description={t('admin.orders.cancelText')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              {t('orderDetail.keep')}
            </Button>
            <Button variant="danger" onClick={doCancel}>
              {t('orderDetail.cancelConfirm')}
            </Button>
          </>
        }
      />
    </div>
  )
}
