import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, CloseIcon } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import type { HistoriqueStatut, StatutCommande } from '@/lib/types'
import { useLang } from '@/lib/useLang'
import { buildTimeline, type TimelineStep } from './status'

function Dot({ step }: { step: TimelineStep }) {
  const reduced = useReducedMotion()
  const base = 'relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2'
  if (step.state === 'done') {
    return (
      <span className={cn(base, 'border-olive-700 bg-olive-700 text-white')}>
        <CheckIcon className="size-4" strokeWidth={2.6} />
      </span>
    )
  }
  if (step.state === 'cancelled') {
    return (
      <span className={cn(base, 'border-danger-600 bg-danger-600 text-white')}>
        <CloseIcon className="size-4" strokeWidth={2.6} />
      </span>
    )
  }
  if (step.state === 'current') {
    return (
      <span className={cn(base, 'border-terracotta-600 bg-white')}>
        {!reduced && (
          <motion.span
            aria-hidden="true"
            className="absolute -inset-1 rounded-full bg-terracotta-600"
            initial={{ opacity: 0.35, scale: 1 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className="size-3 rounded-full bg-terracotta-600" />
      </span>
    )
  }
  return <span className={cn(base, 'border-sand-400 bg-white')} />
}

/**
 * Frise de suivi : verticale sur mobile, horizontale dès `md`. Étape courante pulsée
 * (opacité + échelle, coupée si mouvement réduit), variante « Annulée » en rouge.
 */
export function OrderTimeline({
  statut,
  historique,
}: {
  statut: StatutCommande
  historique: readonly HistoriqueStatut[]
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const steps = buildTimeline(statut, historique)

  return (
    <ol aria-label={t('orderDetail.timeline')} className="flex flex-col md:flex-row">
      {steps.map((step, index) => {
        const last = index === steps.length - 1
        const next = steps[index + 1]
        const lineDone = step.state === 'done' && next && next.state !== 'upcoming'
        return (
          <li
            key={step.statut}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={cn(
              'relative flex gap-4 pb-6 md:flex-1 md:flex-col md:items-center md:gap-3 md:pb-0 md:text-center',
              last && 'pb-0',
              !last &&
                'after:absolute after:start-[15px] after:top-8 after:h-[calc(100%-2rem)] after:w-0.5 md:after:start-1/2 md:after:top-4 md:after:h-0.5 md:after:w-full',
              !last && (lineDone ? 'after:bg-olive-700' : 'after:bg-sand-300'),
            )}
          >
            <Dot step={step} />
            <div className="min-w-0">
              <p
                className={cn(
                  'font-semibold',
                  step.state === 'upcoming' && 'text-ink-500',
                  step.state === 'cancelled' && 'text-danger-800',
                  step.state === 'current' && 'text-terracotta-700',
                )}
              >
                {t(`order.status.${step.statut}`)}
              </p>
              {step.date && (
                <p className="tabular text-sm text-ink-500">{formatDateTime(step.date, lang)}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
