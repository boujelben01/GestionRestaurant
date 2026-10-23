import type { SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Card, StarIcon, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import type { MenuArticle } from '@/lib/types'
import { useLang } from '@/lib/useLang'
import { FALLBACK_IMAGE, resolveImage } from './images'

interface ArticleCardProps {
  article: MenuArticle
  /** Infobulle du bouton « Ajouter » (désactivé à ce stade). Défaut : « Bientôt disponible ». */
  addHint?: string
  className?: string
}

function swapToFallback(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget
  // Évite une boucle si le repli lui-même échoue.
  if (!img.src.endsWith(FALLBACK_IMAGE)) img.src = FALLBACK_IMAGE
}

/**
 * Carte d'article : ligne compacte sur mobile, carte verticale dès `sm`. Un article indisponible
 * reste affiché (image en niveaux de gris, badge) ; le bouton Ajouter est visible mais inactif.
 */
export function ArticleCard({ article, addHint, className }: ArticleCardProps) {
  const { t } = useTranslation()
  const lang = useLang()
  const unavailable = !article.disponible

  return (
    <Card
      as="article"
      interactive={!unavailable}
      className={cn('flex h-full overflow-hidden sm:flex-col', className)}
    >
      <div className="relative w-28 shrink-0 self-stretch overflow-hidden bg-sand-200 sm:w-full sm:self-auto">
        <img
          src={resolveImage(article.imageUrl)}
          alt={article.nom}
          width={600}
          height={400}
          loading="lazy"
          decoding="async"
          onError={swapToFallback}
          className={cn(
            'absolute inset-0 size-full object-cover sm:static sm:aspect-[3/2]',
            unavailable && 'grayscale',
          )}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3
            className={cn(
              'font-display text-xl leading-snug font-semibold',
              unavailable && 'text-ink-500',
            )}
          >
            {article.nom}
          </h3>
          {article.estPopulaire && (
            <Badge tone="gold">
              <StarIcon className="size-3.5" />
              {t('menu.popular')}
            </Badge>
          )}
          {unavailable && <Badge tone="neutral">{t('menu.unavailable')}</Badge>}
        </div>
        {article.description && (
          <p className="line-clamp-2 text-sm text-ink-700">{article.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <p
            className={cn(
              'tabular text-lg font-bold',
              unavailable ? 'text-ink-500' : 'text-terracotta-700',
            )}
          >
            {formatPrice(article.prix, lang)}
          </p>
          <Tooltip content={addHint ?? t('common.comingSoon')} placement="top" align="end">
            <button
              type="button"
              aria-disabled="true"
              aria-label={t('menu.addAria', { name: article.nom })}
              className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-full bg-sand-200 px-5 text-sm font-semibold text-ink-700"
            >
              {t('menu.add')}
            </button>
          </Tooltip>
        </div>
      </div>
    </Card>
  )
}
