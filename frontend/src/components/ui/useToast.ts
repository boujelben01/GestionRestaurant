import { useContext } from 'react'
import { ToastContext, type ToastContextValue } from './toastContext'

/** `const { toast } = useToast(); toast('Ajouté', { variant: 'success' })` */
export function useToast(): Pick<ToastContextValue, 'toast' | 'dismiss'> {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast doit être utilisé dans <ToastProvider>.')
  return { toast: context.toast, dismiss: context.dismiss }
}
