import axios from 'axios'
import { toAppError } from './errors'
import { tokenStore } from './tokenStore'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { Accept: 'application/json' },
})

let onUnauthorized: (() => void) | null = null

/** L'AuthProvider y enregistre la déconnexion + redirection vers /connexion. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const appError = toAppError(error)
    // Un 401 alors qu'un jeton était envoyé = jeton expiré/révoqué. Un 401 de /login
    // (mauvais identifiants) n'a pas de jeton : il reste une erreur de formulaire.
    if (appError.status === 401 && tokenStore.get()) {
      onUnauthorized?.()
    }
    return Promise.reject(appError)
  },
)
