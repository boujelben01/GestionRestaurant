import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActiveOrder } from '@/lib/types'

/**
 * Détection des NOUVELLES commandes entre deux relevés (polls).
 * - `previousIds === null` : premier chargement, jamais d'alerte.
 * - Sinon : commandes EnAttente dont l'identifiant n'était dans AUCUN relevé précédent.
 *   (Une commande déjà vue puis revenue dans la liste ne re-sonne pas.)
 */
export function findNewOrders(
  previousIds: ReadonlySet<number> | null,
  current: readonly Pick<ActiveOrder, 'id' | 'statut'>[],
): number[] {
  if (previousIds === null) return []
  return current.filter((o) => o.statut === 'EnAttente' && !previousIds.has(o.id)).map((o) => o.id)
}

interface Options {
  /** Appelé une fois par relevé qui contient au moins une nouvelle commande. */
  onNew?: (ids: number[]) => void
}

/**
 * Suit les commandes actives de relevé en relevé. `newIds` = nouvelles commandes pas encore
 * « vues » (pastille) ; `dismiss` les marque vues. Aucune alerte au premier chargement.
 */
export function useNewOrderTracker(
  orders: readonly ActiveOrder[] | undefined,
  options: Options = {},
) {
  const seen = useRef<Set<number> | null>(null)
  const onNewRef = useRef(options.onNew)
  useEffect(() => {
    onNewRef.current = options.onNew
  })
  const [newIds, setNewIds] = useState<ReadonlySet<number>>(new Set())

  useEffect(() => {
    if (!orders) return
    const fresh = findNewOrders(seen.current, orders)
    seen.current = new Set([...(seen.current ?? []), ...orders.map((o) => o.id)])
    if (fresh.length > 0) {
      setNewIds((current) => new Set([...current, ...fresh]))
      onNewRef.current?.(fresh)
    }
    // Une commande qui n'est plus en attente n'est plus « nouvelle ».
    setNewIds((current) => {
      const stillPending = new Set(orders.filter((o) => o.statut === 'EnAttente').map((o) => o.id))
      const kept = [...current].filter((id) => stillPending.has(id))
      return kept.length === current.size ? current : new Set(kept)
    })
  }, [orders])

  const dismiss = useCallback(() => setNewIds(new Set()), [])
  return { newIds, newCount: newIds.size, dismiss }
}
