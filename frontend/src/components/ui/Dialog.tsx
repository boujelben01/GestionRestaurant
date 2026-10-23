import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { CloseIcon } from './icons'
import { useFocusTrap, useScrollLock } from './hooks'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  /** Zone d'actions en pied (boutons). */
  footer?: ReactNode
  /** Clic sur le voile = fermeture (vrai par défaut). */
  dismissOnBackdrop?: boolean
}

function DialogPanel({
  onClose,
  title,
  description,
  children,
  footer,
  dismissOnBackdrop = true,
}: Omit<DialogProps, 'open'>) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  useScrollLock(true)
  useFocusTrap(panelRef, true, onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-ink-900/55 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={dismissOnBackdrop ? onClose : undefined}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-xl bg-sand-50 shadow-float sm:max-w-lg sm:rounded-xl"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div>
            <h2 id={titleId} className="text-2xl">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-ink-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('a11y.close')}
            className="-me-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-ink-700 transition-colors hover:bg-sand-200"
          >
            <CloseIcon />
          </button>
        </div>
        {children && <div className="overflow-y-auto px-5 pb-5">{children}</div>}
        {footer && (
          <div className="flex flex-wrap justify-end gap-3 border-t border-sand-200 p-4">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  )
}

/** Dialogue modal accessible : focus piégé, Échap, scroll verrouillé, entrée/sortie animées. */
export function Dialog({ open, ...props }: DialogProps) {
  return createPortal(
    <AnimatePresence>{open && <DialogPanel key="dialog" {...props} />}</AnimatePresence>,
    document.body,
  )
}
