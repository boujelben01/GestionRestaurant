import { describe, expect, it } from 'vitest'
import { buildTableRequest, validateTable } from './validation'

describe('formulaire de table', () => {
  it('à la création, le numéro peut rester vide (numéro automatique)', () => {
    expect(validateTable({ numero: '', capacite: '4' }, { numeroRequired: false })).toEqual({})
    expect(buildTableRequest({ numero: '', capacite: '4' })).toEqual({ capacite: 4 })
  })

  it('à la modification, le numéro est obligatoire', () => {
    expect(validateTable({ numero: '', capacite: '4' }, { numeroRequired: true })).toEqual({
      numero: 'required',
    })
    expect(buildTableRequest({ numero: ' 7 ', capacite: '4' })).toEqual({ numero: 7, capacite: 4 })
  })

  it.each([
    ['0', 'numeroRange'],
    ['10000', 'numeroRange'],
    ['abc', 'integer'],
    ['1.5', 'integer'],
    ['-2', 'integer'],
  ])('numéro %j → %s', (numero, code) => {
    expect(validateTable({ numero, capacite: '4' }, { numeroRequired: false }).numero).toBe(code)
  })

  it.each(['1', '9999'])('numéro limite %s accepté', (numero) => {
    expect(
      validateTable({ numero, capacite: '4' }, { numeroRequired: true }).numero,
    ).toBeUndefined()
  })

  it.each([
    ['', 'required'],
    ['0', 'capaciteRange'],
    ['51', 'capaciteRange'],
    ['x', 'integer'],
  ])('capacité %j → %s', (capacite, code) => {
    expect(validateTable({ numero: '1', capacite }, { numeroRequired: true }).capacite).toBe(code)
  })

  it.each(['1', '50'])('capacité limite %s acceptée', (capacite) => {
    expect(
      validateTable({ numero: '1', capacite }, { numeroRequired: true }).capacite,
    ).toBeUndefined()
  })
})
