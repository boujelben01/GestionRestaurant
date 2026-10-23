import { useTranslation } from 'react-i18next'
import { Badge, type BadgeTone } from '@/components/ui'
import type { StatutCommande } from '@/lib/types'

const TONES: Record<StatutCommande, BadgeTone> = {
  EnAttente: 'gold',
  EnPreparation: 'blue',
  Prete: 'terracotta',
  Terminee: 'olive',
  Annulee: 'danger',
}

/** Statut de commande traduit, coloré selon l'avancement. */
export function OrderStatusBadge({
  statut,
  className,
}: {
  statut: StatutCommande
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <Badge tone={TONES[statut]} dot className={className}>
      {t(`order.status.${statut}`)}
    </Badge>
  )
}
