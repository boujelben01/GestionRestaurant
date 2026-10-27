import { useTranslation } from 'react-i18next'
import { Badge, Button, Dialog, ErrorState, Skeleton, useToast } from '@/components/ui'
import { adminErrorMessage } from '../adminErrors'
import { OrderStatusBadge } from '@/features/orders/OrderStatusBadge'
import { formatDateTime, formatPrice } from '@/lib/format'
import { useLang } from '@/lib/useLang'
import { useAdminOrder, useSetOrderPaid } from './api'

interface OrderDetailDialogProps {
  /** Commande à afficher ; null = fermé. */
  order: { id: number; numero: string; version?: number } | null
  onClose: () => void
}

/** Détail complet d'une commande (client, lignes avec prix, totaux serveur, historique avec auteurs). */
export function OrderDetailDialog({ order, onClose }: OrderDetailDialogProps) {
  const { t } = useTranslation()
  const lang = useLang()
  const { toast } = useToast()
  const setPaid = useSetOrderPaid()
  const { data, isPending, isError, error, refetch, isFetching } = useAdminOrder(
    order?.id ?? null,
    order?.version,
  )

  return (
    <Dialog
      open={order !== null}
      onClose={onClose}
      wide
      title={order?.numero ?? ''}
      footer={
        <Button variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      {isPending && order && (
        <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
      {isError && (
        <ErrorState error={error} compact onRetry={() => void refetch()} retrying={isFetching} />
      )}
      {data && (
        <div className="flex flex-col gap-5 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <OrderStatusBadge statut={data.statut} />
            <Badge tone={data.estPayee ? 'olive' : 'gold'}>
              {data.estPayee ? t('admin.orders.paid') : t('admin.orders.unpaid')}
            </Badge>
            <span className="tabular text-ink-500">{formatDateTime(data.dateCommande, lang)}</span>
          </div>

          <div className="flex flex-col items-start gap-1">
            <Button
              variant="outline"
              size="sm"
              loading={setPaid.isPending}
              aria-disabled={data.statut === 'Annulee' || undefined}
              aria-describedby={data.statut === 'Annulee' ? 'paid-cancelled' : undefined}
              onClick={() => {
                if (data.statut === 'Annulee') return
                const estPayee = !data.estPayee
                setPaid.mutate(
                  { id: data.id, estPayee },
                  {
                    onSuccess: () =>
                      toast(
                        estPayee ? t('admin.orders.markedPaid') : t('admin.orders.markedUnpaid'),
                        {
                          variant: 'success',
                        },
                      ),
                    onError: (error) =>
                      toast(adminErrorMessage(error, t, 'admin.orders.errors.conflict'), {
                        variant: 'error',
                      }),
                  },
                )
              }}
            >
              {data.estPayee ? t('admin.orders.markUnpaid') : t('admin.orders.markPaid')}
            </Button>
            {data.statut === 'Annulee' && (
              <p id="paid-cancelled" className="text-xs text-ink-500">
                {t('admin.orders.paidCancelledHint')}
              </p>
            )}
          </div>

          <dl className="grid gap-3 rounded-md bg-sand-100 p-4 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">{t('admin.orders.customer')}</dt>
              <dd>{data.client.nom}</dd>
            </div>
            <div>
              <dt className="font-semibold">{t('order.phone')}</dt>
              <dd>
                <a
                  href={`tel:${data.client.telephone.replace(/\s/g, '')}`}
                  className="inline-flex min-h-11 items-center font-semibold text-sidi-700 underline underline-offset-4"
                >
                  <bdi dir="ltr" className="tabular">
                    {data.client.telephone}
                  </bdi>
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">{t('confirmation.type')}</dt>
              <dd>{t(`order.type.${data.typeCommande}`)}</dd>
            </div>
            {data.tableNumero !== null && (
              <div>
                <dt className="font-semibold">{t('confirmation.table')}</dt>
                <dd>{t('table.number', { number: data.tableNumero })}</dd>
              </div>
            )}
            {data.adresseLivraison && (
              <div className="sm:col-span-2">
                <dt className="font-semibold">{t('order.address')}</dt>
                <dd>{data.adresseLivraison}</dd>
              </div>
            )}
          </dl>

          {data.note && (
            <div className="rounded-md border-2 border-gold-800/40 bg-gold-100 p-4 text-gold-800">
              <p className="text-eyebrow">{t('admin.orders.note')}</p>
              <p dir="auto" className="mt-1 text-base font-semibold break-words">
                {data.note}
              </p>
            </div>
          )}

          <section>
            <h3 className="mb-2 text-lg">{t('orderDetail.items')}</h3>
            <ul className="divide-y divide-sand-200">
              {data.lignes.map((line, index) => (
                <li key={index} className="flex items-baseline justify-between gap-3 py-2">
                  <span>
                    <span className="tabular font-semibold">{line.quantite} ×</span> {line.nomFr}
                    <span className="tabular text-ink-500">
                      {' '}
                      ({formatPrice(line.prixUnitaire, lang)})
                    </span>
                  </span>
                  <span className="tabular shrink-0">{formatPrice(line.totalLigne, lang)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 flex flex-col gap-1.5 border-t border-sand-300 pt-3">
              <div className="flex justify-between">
                <dt>{t('cart.subtotal')}</dt>
                <dd className="tabular">{formatPrice(data.sousTotal, lang)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t('cart.delivery')}</dt>
                <dd className="tabular">
                  {data.fraisLivraison > 0
                    ? formatPrice(data.fraisLivraison, lang)
                    : t('common.free')}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-sand-300 pt-2">
                <dt className="font-semibold">{t('cart.total')}</dt>
                <dd className="tabular font-display text-xl font-bold text-terracotta-700">
                  {formatPrice(data.total, lang)}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-lg">{t('admin.orders.history')}</h3>
            <ol className="flex flex-col gap-2">
              {data.historique.map((entry, index) => (
                <li key={index} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <OrderStatusBadge statut={entry.statut} />
                  <span className="tabular text-ink-700">{formatDateTime(entry.date, lang)}</span>
                  <span className="text-ink-500">
                    {entry.parNom
                      ? t('admin.orders.by', { name: entry.parNom })
                      : t('admin.orders.bySystem')}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Dialog>
  )
}
