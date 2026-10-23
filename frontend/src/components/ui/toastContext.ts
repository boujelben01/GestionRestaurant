import { createContext } from 'react'

export type ToastVariant = 'info' | 'success' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
  action?: ToastAction
}

export interface ToastOptions {
  variant?: ToastVariant
  /** Durée d'affichage en ms (par défaut 4500 ; 7000 pour une erreur). */
  duration?: number
  /** Bouton d'action (ex. « Voir le panier ») : ferme le toast après le clic. */
  action?: ToastAction
}

export interface ToastContextValue {
  toasts: ToastItem[]
  toast: (message: string, options?: ToastOptions) => number
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
