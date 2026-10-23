import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { AlertIcon, MinusIcon, PlusIcon, TrashIcon } from '@/components/ui'
import { resolveImage } from '@/features/menu/images'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import type { PanierLigne } from '@/lib/types'
import { useLang } from '@/lib/useLang'
import { MAX_QUANTITY, isBlockedLine } from './cartMath'

interface CartLineProps {
  line: PanierLigne
  onQuantity: (articleId: number, quantite: number) => void
  onRemove: (articleId: number) => void
}

/** Ligne de panier animée (layout + fondu) : image, prix, sélecteur 1..20 et suppression. */
export function CartLine({ line, onQuantity, onRemove }: CartLineProps) {
  const { t } = useTranslation()
  const lang = useLang()
  const blocked = isBlockedLine(line)
  const atMax = line.quantite >= MAX_QUANTITY
  const warning =
    line.avertissement === 'inactif' ? t('cart.warningInactive') : t('cart.warningUnavailable')

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'rounded-lg bg-white p-4 shadow-soft',
        blocked && 'border border-danger-600/30',
      )}
    >
      <div className="flex gap-4">
        <img
          src={resolveImage(line.imageUrl)}
          alt=""
          width={160}
          height={160}
          loading="lazy"
          decoding="async"
          className={cn(
            'size-20 shrink-0 rounded-md bg-sand-200 object-cover sm:size-24',
            blocked && 'grayscale',
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                'font-display text-lg leading-snug font-semibold',
                blocked && 'text-ink-500',
              )}
            >
              {line.nom}
            </h3>
            <button
              type="button"
              onClick={() => onRemove(line.articleId)}
              aria-label={t('cart.remove', { name: line.nom })}
              className="-me-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-700 transition-colors hover:bg-danger-100 hover:text-danger-600"
            >
              <TrashIcon />
            </button>
          </div>
          <p className="tabular text-sm text-ink-700">
            {t('cart.unitPrice', { price: formatPrice(line.prixUnitaire, lang) })}
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label={t('cart.quantityOf', { name: line.nom })}
              className="inline-flex items-center rounded-full bg-sand-100"
            >
              <button
                type="button"
                disabled={line.quantite <= 1}
                onClick={() => onQuantity(line.articleId, line.quantite - 1)}
                aria-label={t('cart.decrease', { name: line.nom })}
                className="grid size-11 place-items-center rounded-full text-ink-900 transition-colors hover:bg-sand-200 disabled:opacity-40"
              >
                <MinusIcon />
              </button>
              <span
                className="tabular min-w-8 text-center font-bold"
                aria-label={t('cart.quantity')}
              >
                {line.quantite}
              </span>
              <button
                type="button"
                aria-disabled={atMax || undefined}
                onClick={() => !atMax && onQuantity(line.articleId, line.quantite + 1)}
                aria-label={t('cart.increase', { name: line.nom })}
                className="grid size-11 place-items-center rounded-full text-ink-900 transition-colors hover:bg-sand-200 aria-disabled:opacity-40"
              >
                <PlusIcon />
              </button>
            </div>
            <p
              className={cn(
                'tabular text-lg font-bold',
                blocked ? 'text-ink-500' : 'text-terracotta-700',
              )}
            >
              {formatPrice(line.totalLigne, lang)}
            </p>
          </div>
          {atMax && (
            <p role="status" className="text-xs font-semibold text-gold-800">
              {t('cart.maxReached', { max: MAX_QUANTITY })}
            </p>
          )}
        </div>
      </div>
      {blocked && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-danger-100 p-3 text-sm font-medium text-danger-800">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          {warning}
        </p>
      )}
    </motion.li>
  )
}
