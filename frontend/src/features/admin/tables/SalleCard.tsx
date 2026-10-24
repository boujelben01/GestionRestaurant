import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, ClockIcon, type BadgeTone } from '@/components/ui'
import { OrderStatusBadge } from '@/features/orders/OrderStatusBadge'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import type { EtatTable, SalleOrder, SalleTable } from '@/lib/types'
import { useLang } from '@/lib/useLang'
import { formatAge } from '../orders/relativeAge'
import { canCollect, occupationMinutes } from './salle'

const TONES: Record<EtatTable, BadgeTone> = {
  Libre: 'olive',
  Occupee: 'terracotta',
  AEncaisser: 'gold',
  Inactive: 'neutral',
}

const RING: Record<EtatTable, string> = {
  Libre: 'border-olive-500/40',
  Occupee: 'border-terracotta-500',
  AEncaisser: 'border-gold-400',
  Inactive: 'border-transparent',
}

interface SalleCardProps {
  table: SalleTable
  now: number
  /** Une action sur CETTE table est en cours : boutons désactivés. */
  busy: boolean
  onCollect: (table: SalleTable) => void
  onRelease: (table: SalleTable) => void
  onOpenOrder: (order: SalleOrder) => void
  onGoToGestion: () => void
}

/** Durée d'occupation lisible : « il y a 45 minutes » puis « depuis 2 h 10 ». */
function useAge(premiere: string | null, now: number) {
  const { t } = useTranslation()
  const lang = useLang()
  const minutes = occupationMinutes(premiere, now)
  if (minutes === null) return null
  if (minutes < 1) return t('admin.orders.justNow')
  if (minutes < 60) return formatAge(minutes, lang)
  return t('admin.tables.salle.hoursMinutes', {
    h: Math.floor(minutes / 60),
    m: String(minutes % 60).padStart(2, '0'),
  })
}

export function SalleCard({
  table,
  now,
  busy,
  onCollect,
  onRelease,
  onOpenOrder,
  onGoToGestion,
}: SalleCardProps) {
  const { t } = useTranslation()
  const lang = useLang()
  const age = useAge(table.premiereCommandeUtc, now)
  const inactive = table.etat === 'Inactive'
  const showRelease = !inactive && (table.nombreCommandes > 0 || table.etat !== 'Libre')

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex flex-col gap-3 rounded-lg border-2 p-4 shadow-soft sm:p-5',
        inactive ? 'bg-sand-100' : 'bg-white',
        RING[table.etat],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={cn('font-display text-2xl font-bold', inactive && 'text-ink-500')}>
            {t('admin.tables.table', { number: table.numero })}
          </h2>
          <p className="tabular text-sm text-ink-700">
            {t('admin.tables.seats', { count: table.capacite })}
          </p>
        </div>
        <Badge tone={TONES[table.etat]} dot>
          {t(`admin.tables.salle.state.${table.etat}`)}
        </Badge>
      </div>

      {inactive && (
        <div className="flex flex-col items-start gap-2 text-sm text-ink-700">
          <p>{t('admin.tables.salle.inactiveText')}</p>
          <Button variant="outline" size="sm" onClick={onGoToGestion}>
            {t('admin.tables.salle.goToGestion')}
          </Button>
        </div>
      )}

      {table.etat === 'Libre' && table.nombreCommandes === 0 && (
        <p className="text-sm text-ink-500">{t('admin.tables.salle.noOrders')}</p>
      )}

      {!inactive && table.totalAEncaisser > 0 && (
        <p
          className={cn('rounded-md px-3 py-2 text-sm font-semibold', 'bg-gold-100 text-gold-800')}
        >
          {t('admin.tables.salle.toCollect')}
          <span className="tabular ms-2 font-display text-xl font-bold">
            {formatPrice(table.totalAEncaisser, lang)}
          </span>
        </p>
      )}

      {age && (
        <p className="tabular flex items-center gap-1.5 text-sm text-ink-700">
          <ClockIcon className="size-4" />
          <span className="sr-only">{t('admin.tables.salle.occupation')} : </span>
          {age}
        </p>
      )}

      {table.commandes.length > 0 && (
        <div>
          <p className="text-eyebrow mb-1 text-ink-500">
            {t('admin.tables.salle.ordersCount', { count: table.nombreCommandes })}
          </p>
          <ul className="flex flex-col divide-y divide-sand-200">
            {table.commandes.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
                <button
                  type="button"
                  onClick={() => onOpenOrder(order)}
                  aria-label={t('admin.orders.openDetail', { numero: order.numero })}
                  className="min-h-11 rounded-md font-bold underline-offset-4 hover:underline"
                >
                  <span dir="ltr">{order.numero}</span>
                </button>
                <OrderStatusBadge statut={order.statut} />
                <Badge tone={order.estPayee ? 'olive' : 'gold'}>
                  {order.estPayee ? t('admin.orders.paid') : t('admin.orders.unpaid')}
                </Badge>
                <span className="tabular ms-auto text-sm font-semibold">
                  {formatPrice(order.total, lang)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!inactive && (canCollect(table) || showRelease) && (
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {canCollect(table) && (
            <Button
              size="lg"
              className="min-h-12 flex-1"
              disabled={busy}
              onClick={() => onCollect(table)}
            >
              {t('admin.tables.salle.collect')}
            </Button>
          )}
          {showRelease && (
            <Button
              variant="outline"
              size="lg"
              className="min-h-12"
              disabled={busy}
              onClick={() => onRelease(table)}
            >
              {t('admin.tables.salle.release')}
            </Button>
          )}
        </div>
      )}
    </motion.li>
  )
}
