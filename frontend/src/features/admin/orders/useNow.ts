import { useEffect, useState } from 'react'

/** Horloge qui se met à jour périodiquement (anciennetés « il y a 7 min »). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
