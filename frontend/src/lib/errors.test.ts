import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'
import { AppError, toAppError } from './errors'
import { shouldRetry } from './queryClient'

function httpError(status: number, data: unknown) {
  const config = { headers: {} } as never
  return new AxiosError('fail', 'ERR_BAD_REQUEST', config, null, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  })
}

describe('toAppError', () => {
  it('convertit un ProblemDetails de validation avec clés camelCase', () => {
    const error = toAppError(
      httpError(400, {
        title: 'Une ou plusieurs erreurs de validation se sont produites.',
        status: 400,
        errors: { Password: ['Trop court'], Email: ['Invalide', 'Autre'] },
      }),
    )
    expect(error).toBeInstanceOf(AppError)
    expect(error.status).toBe(400)
    expect(error.fieldErrors).toEqual({ password: ['Trop court'], email: ['Invalide', 'Autre'] })
    expect(error.fieldError('Email')).toBe('Invalide')
    expect(error.fieldError('nom')).toBeUndefined()
  })

  it("conserve le titre et le correlationId d'une erreur sans champ", () => {
    const error = toAppError(httpError(500, { title: 'Erreur interne', correlationId: 'abc' }))
    expect(error.message).toBe('Erreur interne')
    expect(error.correlationId).toBe('abc')
    expect(error.fieldErrors).toEqual({})
  })

  it('signale une panne réseau', () => {
    const error = toAppError(new AxiosError('Network Error', 'ERR_NETWORK'))
    expect(error.isNetwork).toBe(true)
    expect(error.status).toBeNull()
  })

  it('enveloppe une erreur inconnue', () => {
    expect(toAppError(new Error('boom')).message).toBe('boom')
  })
})

describe('shouldRetry', () => {
  it('ne réessaie pas sur un 4xx', () => {
    expect(shouldRetry(0, new AppError('x', { status: 404 }))).toBe(false)
    expect(shouldRetry(0, new AppError('x', { status: 400 }))).toBe(false)
  })

  it('réessaie deux fois sur 5xx ou réseau', () => {
    expect(shouldRetry(0, new AppError('x', { status: 500 }))).toBe(true)
    expect(shouldRetry(1, new AppError('x', { isNetwork: true }))).toBe(true)
    expect(shouldRetry(2, new AppError('x', { status: 500 }))).toBe(false)
  })
})
