/** Règles de CreateTableRequest / UpdateTableRequest (TableRules côté back-end). */
export const NUMERO_MIN = 1
export const NUMERO_MAX = 9999
export const CAPACITE_MIN = 1
export const CAPACITE_MAX = 50

export type TableErrorCode = 'required' | 'integer' | 'numeroRange' | 'capaciteRange'

export interface TableFormValues {
  /** Vide à la création = numéro automatique (le plus grand + 1). Obligatoire à la modification. */
  numero: string
  capacite: string
}

const INTEGER = /^\d+$/

export function validateTable(
  values: TableFormValues,
  options: { numeroRequired: boolean },
): Partial<Record<'numero' | 'capacite', TableErrorCode>> {
  const errors: Partial<Record<'numero' | 'capacite', TableErrorCode>> = {}
  const numero = values.numero.trim()
  if (!numero) {
    if (options.numeroRequired) errors.numero = 'required'
  } else if (!INTEGER.test(numero)) {
    errors.numero = 'integer'
  } else if (Number(numero) < NUMERO_MIN || Number(numero) > NUMERO_MAX) {
    errors.numero = 'numeroRange'
  }

  const capacite = values.capacite.trim()
  if (!capacite) errors.capacite = 'required'
  else if (!INTEGER.test(capacite)) errors.capacite = 'integer'
  else if (Number(capacite) < CAPACITE_MIN || Number(capacite) > CAPACITE_MAX) {
    errors.capacite = 'capaciteRange'
  }
  return errors
}

/** Corps de POST (numero omis si vide) ou de PUT. */
export function buildTableRequest(values: TableFormValues) {
  const numero = values.numero.trim()
  return {
    ...(numero ? { numero: Number(numero) } : {}),
    capacite: Number(values.capacite.trim()),
  }
}
