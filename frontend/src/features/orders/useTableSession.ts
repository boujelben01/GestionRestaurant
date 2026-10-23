import { useMemo, useSyncExternalStore } from 'react'
import { tableSession, type TableSession } from './tableSession'

const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

/** Mémorise la table (après scan) et prévient les composants abonnés. */
export function rememberTable(session: TableSession) {
  tableSession.set(session)
  notify()
}

/** Quitte la table mémorisée et prévient les composants abonnés. */
export function leaveTable() {
  tableSession.clear()
  notify()
}

/** Table mémorisée (sessionStorage), réactive aux changements faits via rememberTable/leaveTable. */
export function useTableSession(): TableSession | null {
  // Le snapshot est une chaîne : stable tant que la valeur ne change pas.
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(tableSession.get()),
    () => 'null',
  )
  return useMemo(() => JSON.parse(raw) as TableSession | null, [raw])
}
