import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  AlertIcon,
  ArrowIcon,
  BagIcon,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Skeleton,
  TrashIcon,
  useToast,
} from '@/components/ui'
import { usePanier, useClearCart, useRemoveItem, useSetQuantity } from '@/features/cart/api'
import { blockedLines, MAX_QUANTITY } from '@/features/cart/cartMath'
import { cartErrorMessage } from '@/features/cart/cartErrors'
import { CartLine } from '@/features/cart/CartLine'
import { TableBanner } from '@/features/orders/TableBanner'
import { useRestaurant } from '@/features/restaurant/api'
import { formatPrice } from '@/lib/format'
import { useLang } from '@/lib/useLang'

function CartSkeleton() {
  const { t } = useTranslation()
  return (
    <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-32 w-full rounded-lg" />
      ))}
    </div>
  )
}

export default function Cart() {
  const { t } = useTranslation()
  const lang = useLang()
  const { toast } = useToast()
  const { data: cart, isPending, isError, refetch, isFetching } = usePanier()
  const { data: restaurant } = useRestaurant()
  const setQuantity = useSetQuantity()
  const removeItem = useRemoveItem()
  const clearCart = useClearCart()
  const [confirmClear, setConfirmClear] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const blocked = blockedLines(cart)
  const closed =
    restaurant !== undefined && (!restaurant.commandesOuvertes || !restaurant.ouvertMaintenant)
  const hasLines = (cart?.lignes.length ?? 0) > 0
  const reason =
    blocked.length > 0 ? t('cart.blockedReason') : closed ? t('cart.closedReason') : null
  const canCheckout = hasLines && reason === null

  const onError = (error: unknown) => toast(cartErrorMessage(error, t), { variant: 'error' })

  const changeQuantity = (articleId: number, quantite: number) => {
    const name = cart?.lignes.find((l) => l.articleId === articleId)?.nom ?? ''
    setQuantity.mutate(
      { articleId, quantite },
      {
        onError,
        onSuccess: () => setAnnouncement(t('cart.quantityChanged', { name, count: quantite })),
      },
    )
  }

  const remove = (articleId: number) => {
    const name = cart?.lignes.find((l) => l.articleId === articleId)?.nom ?? ''
    removeItem.mutate(
      { articleId },
      { onError, onSuccess: () => setAnnouncement(t('cart.removedAnnounce', { name })) },
    )
  }

  const clear = () => {
    setConfirmClear(false)
    clearCart.mutate(undefined, {
      onError,
      onSuccess: () => setAnnouncement(t('cart.clearedAnnounce')),
    })
  }

  return (
    <>
      <Seo title={t('cart.title')} noindex />
      <TableBanner />
      <PageHeader title={t('cart.title')}>
        {cart && hasLines && (
          <p className="text-ink-700">{t('cart.itemCount', { count: cart.nombreArticles })}</p>
        )}
      </PageHeader>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="container-page flex-1 pt-8 pb-40 lg:pb-16">
        {closed && (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-md border border-gold-800/30 bg-gold-100 p-4 text-sm font-medium text-gold-800"
          >
            <AlertIcon className="mt-0.5 size-5 shrink-0" />
            <p>{t('cart.closedBanner')}</p>
          </div>
        )}

        {isPending && <CartSkeleton />}
        {isError && (
          <ErrorState
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
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
            <section aria-label={t('cart.linesLabel')}>
              <ul className="flex flex-col gap-4">
                <AnimatePresence initial={false}>
                  {cart.lignes.map((line) => (
                    <CartLine
                      key={line.articleId}
                      line={line}
                      onQuantity={changeQuantity}
                      onRemove={remove}
                    />
                  ))}
                </AnimatePresence>
              </ul>
              <div className="mt-4 flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<TrashIcon className="size-4" />}
                  onClick={() => setConfirmClear(true)}
                >
                  {t('cart.clear')}
                </Button>
                <Button to="/menu" variant="ghost" size="sm">
                  {t('cart.addMore')}
                </Button>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                {t('cart.maxHint', { max: MAX_QUANTITY })}
              </p>
            </section>

            <aside
              aria-label={t('cart.summary')}
              className="fixed inset-x-0 bottom-0 z-30 border-t border-sand-300 bg-white p-4 shadow-float lg:sticky lg:top-28 lg:rounded-lg lg:border lg:p-6 lg:shadow-soft"
            >
              <div className="mx-auto flex max-w-xl flex-col gap-3 lg:max-w-none">
                <dl className="flex items-baseline justify-between gap-4">
                  <dt className="font-semibold">{t('cart.subtotal')}</dt>
                  <dd className="tabular font-display text-2xl font-bold text-terracotta-700">
                    {formatPrice(cart.sousTotal, lang)}
                  </dd>
                </dl>
                <p className="hidden text-sm text-ink-500 lg:block">{t('cart.feesNote')}</p>
                {reason && (
                  <p
                    id="checkout-reason"
                    className="flex items-start gap-2 text-sm font-medium text-danger-800"
                  >
                    <AlertIcon className="mt-0.5 size-4 shrink-0" />
                    {reason}
                  </p>
                )}
                <Button
                  to={canCheckout ? '/commande' : undefined}
                  href={canCheckout ? undefined : '#'}
                  aria-disabled={canCheckout ? undefined : true}
                  aria-describedby={reason ? 'checkout-reason' : undefined}
                  onClick={(event) => !canCheckout && event.preventDefault()}
                  size="lg"
                  fullWidth
                  icon={<ArrowIcon />}
                >
                  {t('cart.checkout')}
                </Button>
              </div>
            </aside>
          </div>
        )}
      </div>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title={t('cart.clearTitle')}
        description={t('cart.clearText')}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={clear}>
              {t('cart.clearConfirm')}
            </Button>
          </>
        }
      />
    </>
  )
}
