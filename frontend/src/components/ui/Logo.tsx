import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

/** Marque : carreau (étoile à 8 branches) terre cuite + point doré. Original, sans emprunt. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn('size-9 shrink-0', className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" rx="11" fill="#a94d2a" />
      <g fill="none" stroke="#fbf7ef" strokeWidth="2" strokeLinejoin="round">
        <rect x="11.5" y="11.5" width="17" height="17" rx="1" />
        <rect x="11.5" y="11.5" width="17" height="17" rx="1" transform="rotate(45 20 20)" />
      </g>
      <circle cx="20" cy="20" r="2.8" fill="#d4a63c" />
    </svg>
  )
}

interface LogoProps {
  className?: string
  /** Couleur du texte (par défaut l'encre) : passer `text-sand-50` sur fond sombre. */
  textClassName?: string
  /** Affiche seulement la marque. */
  markOnly?: boolean
}

/** Logo complet : marque + wordmark (nom depuis i18n `brand.name`). */
export function Logo({ className, textClassName, markOnly }: LogoProps) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {!markOnly && (
        <span
          className={cn(
            'font-display text-2xl leading-none font-bold tracking-tight',
            textClassName ?? 'text-ink-900',
          )}
        >
          {t('brand.name')}
        </span>
      )}
    </span>
  )
}
