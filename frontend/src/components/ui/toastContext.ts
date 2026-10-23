import { createContext } from 'react'

export type ToastVariant = 'info' | 'success' | 'error'

export interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

export interface ToastOptions {
  variant?: ToastVariant
  /** Durée d'affichage en ms (par défaut 4500 ; 7000 pour une erreur). */
  duration?: number
}

export interface ToastContextValue {
  toasts: ToastItem[]
  toast: (message: string, options?: ToastOptions) => number
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
