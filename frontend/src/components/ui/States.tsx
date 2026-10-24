import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { toAppError } from '@/lib/errors'
import { Button } from './Button'
import { AlertIcon } from './icons'
import { ZelligePattern } from './Zellige'

interface StateShellProps {
  icon: ReactNode
  title: string
  description?: string
  /** Détail technique discret sous la description (code HTTP, référence). */
  detail?: ReactNode
  action?: ReactNode
  compact?: boolean
  className?: string
  tone: 'neutral' | 'error'
}

function StateShell({
  icon,
  title,
  description,
  detail,
  action,
  compact,
  className,
  tone,
}: StateShellProps) {
  return (
    <div
      className={cn(
        'relative isolate flex flex-col items-center overflow-hidden rounded-xl text-center text-ink-900',
        tone === 'error' ? 'bg-danger-100' : 'bg-sand-100',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      <ZelligePattern className="-z-10 text-ink-900 opacity-[0.04]" />
      <div
        className={cn(
          'grid size-14 place-items-center rounded-full bg-white text-2xl shadow-soft',
          tone === 'error' ? 'text-danger-600' : 'text-terracotta-600',
        )}
      >
        {icon}
      </div>
      <h2 className={cn('font-semibold', compact ? 'text-lg' : 'text-2xl')}>{title}</h2>
      {description && <p className="max-w-md text-ink-700">{description}</p>}
      {detail}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  /** Désactive le bouton pendant une nouvelle tentative. */
  retrying?: boolean
  /** Erreur de la requête : affiche discrètement le code HTTP et la référence de corrélation. */
  error?: unknown
  compact?: boolean
  className?: string
}

/** Erreur de chargement avec bouton « Réessayer » (annoncée aux lecteurs d'écran). */
export function ErrorState({
  title,
  message,
  onRetry,
  retrying,
  error,
  compact,
  className,
}: ErrorStateProps) {
  const { t } = useTranslation()
  const technical = error ? toAppError(error) : null
  const code = technical
    ? technical.isNetwork
      ? t('errors.networkCode')
      : technical.status !== null
        ? t('errors.httpCode', { status: technical.status })
        : null
    : null
  const reference = technical?.correlationId
    ? t('errors.reference', { id: technical.correlationId })
    : null
  return (
    <div role="alert">
      <StateShell
        tone="error"
        icon={<AlertIcon />}
        title={title ?? t('errors.loadFailedTitle')}
        description={message ?? t('errors.loadFailed')}
        detail={
          (code || reference) && (
            <p dir="ltr" className="text-xs break-all text-ink-500 select-text">
              {[code, reference].filter(Boolean).join(' · ')}
            </p>
          )
        }
        compact={compact}
        className={className}
        action={
          onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} loading={retrying}>
              {t('common.retry')}
            </Button>
          )
        }
      />
    </div>
  )
}

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
  className?: string
}

/** Liste vide (panier, commandes, catégorie…) avec appel à l'action optionnel. */
export function EmptyState(props: EmptyStateProps) {
  return <StateShell tone="neutral" {...props} />
}
