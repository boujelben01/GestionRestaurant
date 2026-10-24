import QRCode from 'qrcode'
import type { AdminTable } from '@/lib/types'

export const DEFAULT_PUBLIC_URL = 'http://localhost:5173'

/** Adresse publique du site (VITE_PUBLIC_URL), sans slash final ; valeur de développement par défaut. */
export function publicBaseUrl(value: string | undefined = import.meta.env.VITE_PUBLIC_URL): string {
  const trimmed = (value ?? '').trim()
  return (trimmed || DEFAULT_PUBLIC_URL).replace(/\/+$/, '')
}

/** URL encodée dans le QR d'une table : `<adresse du site>/table/<code>`, avec ou sans slash final. */
export function tableQrUrl(base: string, code: string): string {
  return `${base.trim().replace(/\/+$/, '')}/table/${code}`
}

/**
 * Vrai si l'adresse pointe vers la machine locale : un QR imprimé avec une telle adresse ne
 * fonctionnerait pas pour les clients. Contient « localhost », ou est une adresse de boucle locale.
 */
export function isLocalAddress(url: string): boolean {
  const text = url.trim().toLowerCase()
  if (text.includes('localhost')) return true
  try {
    const host = new URL(text).hostname
    return host === '127.0.0.1' || host === '[::1]' || host === '::1' || host === '0.0.0.0'
  } catch {
    return /(^|\/\/)(127\.0\.0\.1|0\.0\.0\.0|\[::1\])/.test(text)
  }
}

/** Seules les tables ACTIVES sont imprimées, par numéro croissant. */
export function printableTables(tables: readonly AdminTable[]): AdminTable[] {
  return tables.filter((t) => t.estActive).sort((a, b) => a.numero - b.numero || a.id - b.id)
}

/**
 * QR code en image SVG (data URI) : généré dans le navigateur, aucun service externe, contraste maximal
 * (noir sur blanc, marge de 2 modules, correction d'erreur M). Une image est préférable à du HTML injecté :
 * elle porte un `alt` et s'imprime telle quelle.
 */
export async function qrDataUri(url: string): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  })
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
