/**
 * Table mémorisée après le scan d'un QR (/table/:code). sessionStorage : la table n'a de sens que
 * pour la visite en cours, elle disparaît à la fermeture de l'onglet.
 */
const KEY = 'resto.table'

export interface TableSession {
  code: string
  numero: number
}

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isValidTableCode = (code: string) => GUID_RE.test(code)

export const tableSession = {
  get(): TableSession | null {
    try {
      const raw = sessionStorage.getItem(KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<TableSession>
      if (typeof parsed.code === 'string' && typeof parsed.numero === 'number') {
        return { code: parsed.code, numero: parsed.numero }
      }
    } catch {
      /* stockage indisponible ou valeur corrompue */
    }
    return null
  },
  set(session: TableSession) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(session))
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  },
}
