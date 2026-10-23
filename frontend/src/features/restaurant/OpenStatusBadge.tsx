import { useTranslation } from 'react-i18next'
import { Badge, Skeleton } from '@/components/ui'
import { useRestaurant } from './api'

/**
 * Pastille Ouvert / Fermé. Squelette pendant le chargement ; en cas d'erreur on n'affiche
 * rien plutôt qu'un statut potentiellement faux.
 */
export function OpenStatusBadge({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { data, isPending } = useRestaurant()
  if (isPending) return <Skeleton className={`h-7 w-36 rounded-full ${className ?? ''}`} />
  if (!data) return null
  return (
    <Badge tone={data.ouvertMaintenant ? 'olive' : 'danger'} dot className={className}>
      {data.ouvertMaintenant ? t('restaurant.openNow') : t('restaurant.closedNow')}
    </Badge>
  )
}
