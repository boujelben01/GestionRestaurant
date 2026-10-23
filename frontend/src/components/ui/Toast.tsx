import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from './icons'
import {
  ToastContext,
  type ToastContextValue,
  type ToastItem,
  type ToastOptions,
  type ToastVariant,
} from './toastContext'

const MAX_TOASTS = 3

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, { variant = 'info', duration }: ToastOptions = {}) => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, message, variant }].slice(-MAX_TOASTS))
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration ?? (variant === 'error' ? 7000 : 4500)),
      )
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, toast, dismiss }),
    [toasts, toast, dismiss],
  )
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

const styles: Record<ToastVariant, { box: string; icon: ReactNode }> = {
  info: { box: 'bg-ink-900 text-sand-50', icon: <InfoIcon /> },
  success: { box: 'bg-olive-700 text-white', icon: <CheckIcon /> },
  error: { box: 'bg-danger-800 text-white', icon: <AlertIcon /> },
}

/** Zone live (aria-live) où s'empilent les notifications ; à monter une fois dans le Layout. */
export function Toaster() {
  const { t } = useTranslation()
  const context = useContext(ToastContext)
  if (!context) throw new Error('Toaster doit être utilisé dans <ToastProvider>.')
  const { toasts, dismiss } = context

  return (
    <div
      role="region"
      aria-label={t('a11y.notifications')}
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:justify-end sm:pe-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => (
          <motion.div
            key={item.id}
            layout
            role={item.variant === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg py-2 ps-4 pe-2 shadow-float',
              styles[item.variant].box,
            )}
          >
            <span className="shrink-0">{styles[item.variant].icon}</span>
            <p className="flex-1 py-1.5 text-sm font-medium">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label={t('a11y.close')}
              className="grid size-11 shrink-0 place-items-center rounded-full opacity-80 transition-opacity hover:opacity-100"
            >
              <CloseIcon className="size-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
