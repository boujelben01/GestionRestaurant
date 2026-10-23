import { useState, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { HelmetProvider } from 'react-helmet-async'
import { ToastProvider } from '@/components/ui'
import { createQueryClient } from '@/lib/queryClient'

/**
 * Providers globaux hors Router. L'instance i18next est globale (initReactI18next dans
 * lib/i18n), donc pas d'I18nextProvider. AuthProvider vit dans <Root/> car il a besoin du Router.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        {/* reducedMotion="user" : si l'OS demande moins de mouvement, transform/layout sont neutralisés. */}
        <MotionConfig reducedMotion="user">
          <ToastProvider>{children}</ToastProvider>
        </MotionConfig>
      </QueryClientProvider>
    </HelmetProvider>
  )
}
