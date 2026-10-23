/**
 * Stockage du jeton JWT dans localStorage.
 * Limite connue : tout script injecté (XSS) peut lire le jeton. Voir frontend/README.md.
 */
const TOKEN_KEY = 'resto.token'
const EXPIRY_KEY = 'resto.token.expiresAt'

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const tokenStore = {
  get(): string | null {
    return safe(() => localStorage.getItem(TOKEN_KEY), null)
  },
  getExpiry(): Date | null {
    const raw = safe(() => localStorage.getItem(EXPIRY_KEY), null)
    if (!raw) return null
    const date = new Date(raw)
    return Number.isNaN(date.getTime()) ? null : date
  },
  /** Vrai si un jeton est présent et non expiré. */
  isValid(now: Date = new Date()): boolean {
    const expiry = this.getExpiry()
    return this.get() !== null && expiry !== null && expiry.getTime() > now.getTime()
  },
  set(token: string, expiresAtUtc: string) {
    safe(() => {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(EXPIRY_KEY, expiresAtUtc)
    }, undefined)
  },
  clear() {
    safe(() => {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(EXPIRY_KEY)
    }, undefined)
  },
}
