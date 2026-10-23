import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { api } from '@/lib/api'

export interface MockResponse {
  status?: number
  data?: unknown
}

export type MockHandler = (
  config: InternalAxiosRequestConfig,
) => MockResponse | Promise<MockResponse>

/**
 * Remplace l'adaptateur HTTP d'axios par des handlers en mémoire (aucun réseau).
 * Clé = « METHODE /chemin ». Les statuts >= 400 sont rejetés comme le ferait axios,
 * ce qui exerce donc les vrais intercepteurs de lib/api.ts.
 */
export function mockApi(handlers: Record<string, MockHandler>) {
  const calls: InternalAxiosRequestConfig[] = []
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config)
    const key = `${(config.method ?? 'get').toUpperCase()} ${config.url}`
    const handler = handlers[key]
    if (!handler) throw new Error(`Aucun mock pour ${key}`)
    const { status = 200, data } = await handler(config)
    const response = { data, status, statusText: String(status), headers: {}, config }
    if (status >= 400) {
      throw new AxiosError(`HTTP ${status}`, 'ERR_BAD_REQUEST', config, null, response)
    }
    return response
  }
  const previous = api.defaults.adapter
  api.defaults.adapter = adapter
  return {
    calls,
    restore: () => {
      api.defaults.adapter = previous
    },
  }
}

export function networkError(): MockHandler {
  return (config) => {
    throw new AxiosError('Network Error', 'ERR_NETWORK', config)
  }
}
