import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { AlertIcon, Badge, Button, ClockIcon, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime, formatPrice } from '@/lib/format'
import type { ActiveOrder, StatutCommande } from '@/lib/types'
import { useLang } from '@/lib/useLang'
import { useAdminOrder } from './api'
import { formatAge } from './relativeAge'
import { advanceTarget, ageMinutes, isLate, nextStatuses } from './transitions'

interface OrderCardProps {
  order: ActiveOrder
  /** Nouvelle commande pas encore acquittée : anneau + libellé. */
  isNew: boolean
  now: number
  /** Une mise à jour de CETTE commande est en cours : boutons désactivés (anti-doublon). */
  busy: boolean
  onOpen: (order: ActiveOrder) => void
  onStatus: (order: ActiveOrder, statut: StatutCommande) => void
  onCancel: (order: ActiveOrder) => void
  onPaid: (order: ActiveOrder, estPayee: boolean) => void
}

/** Carte de commande du tableau : tout ce qu'il faut pour préparer, encaisser et faire avancer. */
export function OrderCard({
  order,
  isNew,
  now,
  busy,
  onOpen,
  onStatus,
  onCancel,
  onPaid,
}: OrderCardProps) {
  const { t } = useTranslation()
  const lang = useLang()
  // Le détail (téléphone, total, paiement, adresse) n'est pas dans /actives : chargé une fois par version.
  const { data: detail, isPending } = useAdminOrder(order.id, order.version)

  const minutes = ageMinutes(order.dateMiseAJour, now)
  const late = isLate(order.statut, minutes)
  const age = formatAge(minutes, lang) ?? t('admin.orders.justNow')
  const target = advanceTarget(order.statut)
  const canCancel = nextStatuses(order.statut).includes('Annulee')

  return (
    <motion.li
      layout
      layoutId={`order-${order.id}`}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex flex-col gap-3 rounded-lg border-2 bg-white p-4 shadow-soft',
        late ? 'border-danger-600' : 'border-transparent',
        isNew && !late && 'border-terracotta-600 ring-4 ring-terracotta-600/20',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpen(order)}
          aria-label={t('admin.orders.openDetail', { numero: order.numero })}
          className="min-h-11 rounded-md text-start font-display text-xl font-bold underline-offset-4 hover:underline"
        >
          <span dir="ltr">{order.numero}</span>
        </button>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {isNew && <Badge tone="terracotta">{t('admin.orders.newBadge')}</Badge>}
          {late && (
            <Badge tone="danger">
              <AlertIcon className="size-3.5" />
              {t('admin.orders.late')}
            </Badge>
          )}
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-700">
        <span className="tabular">{formatDateTime(order.dateCommande, lang)}</span>
        <span
          className={cn(
            'tabular inline-flex items-center gap-1',
            late && 'font-bold text-danger-800',
          )}
        >
          <ClockIcon className="size-4" />
          {age}
        </span>
      </p>

      <div className="text-sm">
        <p className="font-semibold">{order.nomClient}</p>
        {isPending ? (
          <Skeleton className="mt-1 h-5 w-32" />
        ) : detail ? (
          <a
            href={`tel:${detail.client.telephone.replace(/\s/g, '')}`}
            className="inline-flex min-h-11 items-center font-semibold text-sidi-700 underline underline-offset-4"
          >
            <bdi dir="ltr" className="tabular">
              {detail.client.telephone}
            </bdi>
          </a>
        ) : null}
        <p className="text-ink-700">
          {order.typeCommande === 'SurPlace' && order.tableNumero !== null
            ? t('table.number', { number: order.tableNumero })
            : order.typeCommande === 'Livraison'
              ? (detail?.adresseLivraison ?? t('order.type.Livraison'))
              : t('order.type.ARemporter')}
        </p>
      </div>

      <ul className="flex flex-col gap-0.5 border-y border-sand-200 py-2 text-base">
        {order.lignes.map((line, index) => (
          <li key={index}>
            <span className="tabular font-bold">{line.quantite} ×</span>{' '}
            {lang === 'ar' ? line.nomAr : line.nomFr}
          </li>
        ))}
      </ul>

      {order.note && (
        <div className="rounded-md border-2 border-gold-800/40 bg-gold-100 p-3 text-gold-800">
          <p className="text-eyebrow">{t('admin.orders.note')}</p>
          <p dir="auto" className="mt-0.5 font-semibold break-words">
            {order.note}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {isPending ? (
          <Skeleton className="h-7 w-24" />
        ) : detail ? (
          <>
            <p className="tabular font-display text-xl font-bold text-terracotta-700">
              {formatPrice(detail.total, lang)}
            </p>
            <Badge tone={detail.estPayee ? 'olive' : 'gold'}>
              {detail.estPayee ? t('admin.orders.paid') : t('admin.orders.unpaid')}
            </Badge>
          </>
        ) : null}
      </div>
      {detail && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onPaid(order, !detail.estPayee)}
        >
          {detail.estPayee ? t('admin.orders.markUnpaid') : t('admin.orders.markPaid')}
        </Button>
      )}

      <div className="flex flex-wrap gap-2">
        {target && (
          <Button
            size="lg"
            className="min-h-14 flex-1"
            loading={busy}
            onClick={() => onStatus(order, target)}
          >
            {t(`admin.orders.action.${target}`)}
          </Button>
        )}
        {canCancel && (
          <Button variant="outline" size="lg" disabled={busy} onClick={() => onCancel(order)}>
            {t('admin.orders.cancel')}
          </Button>
        )}
      </div>
    </motion.li>
  )
}
