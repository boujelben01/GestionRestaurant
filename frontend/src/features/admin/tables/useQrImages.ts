import { useEffect, useState } from 'react'
import { qrDataUri } from './qr'

/**
 * Génère (une seule fois par URL) les QR codes en data URI. `images[url]` n'existe qu'une fois l'image
 * prête : l'impression attend que toutes les images utiles soient présentes.
 */
export function useQrImages(urls: readonly string[]) {
  const [images, setImages] = useState<Record<string, string>>({})
  const key = urls.join('\n')

  useEffect(() => {
    const missing = key ? key.split('\n').filter((url) => !images[url]) : []
    if (missing.length === 0) return
    let cancelled = false
    void Promise.all(missing.map(async (url) => [url, await qrDataUri(url)] as const)).then(
      (entries) => {
        if (!cancelled) setImages((current) => ({ ...current, ...Object.fromEntries(entries) }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [key, images])

  return images
}
