import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import {
  AlertIcon,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Skeleton,
  TableIcon,
  useToast,
} from '@/components/ui'
import { toAppError } from '@/lib/errors'
import { formatPrice } from '@/lib/format'
import type { EtatTable, SalleOrder, SalleTable } from '@/lib/types'
import { useLang } from '@/lib/useLang'
import { OrderDetailDialog } from '../orders/OrderDetailDialog'
import { useNow } from '../orders/useNow'
import { releaseBlockers, salleSummary } from './salle'
import { useCollectTable, useReleaseTable, useSalle } from './salleApi'
import { SalleCard } from './SalleCard'

type Action = { kind: 'collect' | 'release'; id: number }

/** Onglet « Salle » : état de chaque table en temps réel, encaissement et libération. */
export function SalleView({ onGoToGestion }: { onGoToGestion: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const { toast } = useToast()
  const { data, isPending, isError, error, refetch, isFetching } = useSalle()
  const collect = useCollectTable()
  const release = useReleaseTable()
  const now = useNow()

  const [action, setAction] = useState<Action | null>(null)
  const [dialogError, setDialogError] = useState<string>()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [order, setOrder] = useState<SalleOrder | null>(null)

  // La table concernée par le dialogue est relue à chaque rendu : montants et blocages restent à jour.
  const target = action ? data?.find((tbl) => tbl.id === action.id) : undefined
  const summary = useMemo(() => salleSummary(data ?? []), [data])

  // Annonce un changement d'état entre deux relevés (jamais au premier chargement).
  const [previous, setPrevious] = useState<Record<number, EtatTable> | null>(null)
  const [announcement, setAnnouncement] = useState('')
  if (data) {
    const current = Object.fromEntries(data.map((tbl) => [tbl.id, tbl.etat]))
    if (previous === null) {
      setPrevious(current)
    } else if (JSON.stringify(previous) !== JSON.stringify(current)) {
      const changed = data.filter((tbl) => previous[tbl.id] && previous[tbl.id] !== tbl.etat)
      if (changed.length > 0) {
        setAnnouncement(
          changed
            .map((tbl) =>
              t('admin.tables.salle.changed', {
                number: tbl.numero,
                state: t(`admin.tables.salle.state.${tbl.etat}`).toLowerCase(),
              }),
            )
            .join('. '),
        )
      }
      setPrevious(current)
    }
  }

  const close = () => {
    setAction(null)
    setDialogError(undefined)
  }

  const run = (table: SalleTable) => {
    if (!action) return
    setDialogError(undefined)
    setBusyId(table.id)
    const handlers = {
      onError: (e: unknown) => setDialogError(toAppError(e).message || t('errors.generic')),
      onSettled: () => setBusyId(null),
    }
    if (action.kind === 'collect') {
      const amount = formatPrice(table.totalAEncaisser, lang)
      collect.mutate(
        { id: table.id },
        {
          ...handlers,
          onSuccess: () => {
            close()
            toast(t('admin.tables.salle.collected', { number: table.numero, amount }), {
              variant: 'success',
            })
          },
        },
      )
    } else {
      release.mutate(
        { id: table.id },
        {
          ...handlers,
          onSuccess: () => {
            close()
            toast(t('admin.tables.salle.released', { number: table.numero }), {
              variant: 'success',
            })
          },
        },
      )
    }
  }

  const blockers = target ? releaseBlockers(target) : { inProgress: 0, unpaid: 0 }
  const dialogBusy = busyId !== null && busyId === action?.id

  const counters: Array<{ key: string; value: number; tone: string; label: string }> = [
    {
      key: 'free',
      value: summary.libres,
      tone: 'text-olive-700',
      label: t('admin.tables.salle.freeTables', { count: summary.libres }),
    },
    {
      key: 'busy',
      value: summary.occupees,
      tone: 'text-terracotta-700',
      label: t('admin.tables.salle.busyTables', { count: summary.occupees }),
    },
    {
      key: 'collect',
      value: summary.aEncaisser,
      tone: 'text-gold-800',
      label: t('admin.tables.salle.collectTables', { count: summary.aEncaisser }),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {data && (
        <section aria-label={t('admin.tables.salle.summary')} aria-live="polite">
          <div className="grid grid-cols-3 gap-3">
            {counters.map((counter) => (
              <div
                key={counter.key}
                className="rounded-lg bg-white p-3 text-center shadow-soft sm:p-4"
              >
                <p className={`tabular font-display text-4xl font-bold ${counter.tone}`}>
                  {counter.value}
                </p>
                <p className="mt-1 text-xs font-semibold text-ink-700 sm:text-sm">
                  {counter.label}
                </p>
              </div>
            ))}
          </div>
          {summary.inactives > 0 && (
            <p className="mt-2 text-sm text-ink-500">
              {t('admin.tables.salle.inactiveTables', { count: summary.inactives })}
            </p>
          )}
        </section>
      )}

      {isError && data && (
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
        <div
          role="status"
          aria-label={t('common.loading')}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      )}
      {isError && !data && (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} />
      )}
      {data && data.length === 0 && (
        <EmptyState
          icon={<TableIcon />}
          title={t('admin.tables.empty')}
          description={t('admin.tables.salle.emptyText')}
          action={<Button onClick={onGoToGestion}>{t('admin.tables.salle.goToGestion')}</Button>}
        />
      )}

      <ul className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence initial={false}>
          {data?.map((table) => (
            <SalleCard
              key={table.id}
              table={table}
              now={now}
              busy={busyId === table.id}
              onCollect={(tbl) => {
                setDialogError(undefined)
                setAction({ kind: 'collect', id: tbl.id })
              }}
              onRelease={(tbl) => {
                setDialogError(undefined)
                setAction({ kind: 'release', id: tbl.id })
              }}
              onOpenOrder={setOrder}
              onGoToGestion={onGoToGestion}
            />
          ))}
        </AnimatePresence>
      </ul>

      <OrderDetailDialog order={order} onClose={() => setOrder(null)} />

      <Dialog
        open={action?.kind === 'collect' && target !== undefined}
        onClose={close}
        title={t('admin.tables.salle.collectTitle', { number: target?.numero ?? '' })}
        footer={
          <>
            <Button variant="outline" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button loading={dialogBusy} onClick={() => target && run(target)}>
              {t('admin.tables.salle.collectConfirm', {
                amount: formatPrice(target?.totalAEncaisser ?? 0, lang),
              })}
            </Button>
          </>
        }
      >
        {target && (
          <div className="flex flex-col gap-3">
            <p className="tabular font-display text-4xl font-bold text-terracotta-700">
              {formatPrice(target.totalAEncaisser, lang)}
            </p>
            <p className="text-ink-700">
              {t('admin.tables.salle.collectText', { count: target.nombreCommandes })}
            </p>
            {dialogError && <DialogError message={dialogError} />}
          </div>
        )}
      </Dialog>

      <Dialog
        open={action?.kind === 'release' && target !== undefined}
        onClose={close}
        title={t('admin.tables.salle.releaseTitle', { number: target?.numero ?? '' })}
        description={t('admin.tables.salle.releaseText')}
        footer={
          <>
            <Button variant="outline" onClick={close}>
              {t('common.cancel')}
            </Button>
            {blockers.inProgress === 0 && blockers.unpaid > 0 && target && (
              <Button
                variant="outline"
                onClick={() => {
                  setDialogError(undefined)
                  setAction({ kind: 'collect', id: target.id })
                }}
              >
                {t('admin.tables.salle.collectFirst')}
              </Button>
            )}
            <Button variant="danger" loading={dialogBusy} onClick={() => target && run(target)}>
              {t('admin.tables.salle.releaseConfirm')}
            </Button>
          </>
        }
      >
        {target && (
          <div className="flex flex-col gap-3 text-sm">
            {blockers.inProgress > 0 && (
              <p className="flex items-start gap-2 font-medium text-danger-800">
                <AlertIcon className="mt-0.5 size-4 shrink-0" />
                {t('admin.tables.salle.blockedInProgress', { count: blockers.inProgress })}
              </p>
            )}
            {blockers.unpaid > 0 && (
              <p className="flex items-start gap-2 font-medium text-danger-800">
                <AlertIcon className="mt-0.5 size-4 shrink-0" />
                {t('admin.tables.salle.blockedUnpaid', { count: blockers.unpaid })}
              </p>
            )}
            {dialogError && <DialogError message={dialogError} />}
          </div>
        )}
      </Dialog>
    </div>
  )
}

/** Message du serveur (409…) affiché dans le dialogue : jamais d'échec silencieux. */
function DialogError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger-600/30 bg-danger-100 p-3 text-sm font-medium text-danger-800"
    >
      <AlertIcon className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  )
}
