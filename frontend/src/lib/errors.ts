import { AxiosError } from 'axios'

/** Réponse d'erreur RFC 7807 (application/problem+json) émise par l'API. */
interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  errors?: Record<string, string[]>
  correlationId?: string
}

/** Erreur applicative normalisée : tout ce dont les écrans ont besoin. */
export class AppError extends Error {
  readonly status: number | null
  /** Erreurs de validation par champ, clés en camelCase (ex. « password »). */
  readonly fieldErrors: Record<string, string[]>
  readonly correlationId?: string
  readonly isNetwork: boolean

  constructor(
    message: string,
    options: {
      status?: number | null
      fieldErrors?: Record<string, string[]>
      correlationId?: string
      isNetwork?: boolean
    } = {},
  ) {
    super(message)
    this.name = 'AppError'
    this.status = options.status ?? null
    this.fieldErrors = options.fieldErrors ?? {}
    this.correlationId = options.correlationId
    this.isNetwork = options.isNetwork ?? false
  }

  /** Premier message d'erreur d'un champ, insensible à la casse des clés serveur. */
  fieldError(field: string): string | undefined {
    const key = Object.keys(this.fieldErrors).find((k) => k.toLowerCase() === field.toLowerCase())
    return key ? this.fieldErrors[key]?.[0] : undefined
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

const camel = (key: string) => key.charAt(0).toLowerCase() + key.slice(1)

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof AxiosError) {
    if (!error.response) {
      return new AppError(error.message, { isNetwork: true })
    }
    const { status, data } = error.response as { status: number; data?: ProblemDetails }
    const fieldErrors: Record<string, string[]> = {}
    for (const [key, messages] of Object.entries(data?.errors ?? {})) {
      fieldErrors[camel(key)] = messages
    }
    return new AppError(data?.title ?? error.message, {
      status,
      fieldErrors,
      correlationId: data?.correlationId,
    })
  }
  return new AppError(error instanceof Error ? error.message : String(error))
}
