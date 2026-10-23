import { afterEach, describe, expect, it } from 'vitest'
import { isValidTableCode, tableSession } from './tableSession'

afterEach(() => sessionStorage.clear())

describe('tableSession', () => {
  it('mémorise et relit la table pour la session', () => {
    expect(tableSession.get()).toBeNull()
    tableSession.set({ code: '11111111-1111-4111-8111-111111111111', numero: 4 })
    expect(tableSession.get()).toEqual({ code: '11111111-1111-4111-8111-111111111111', numero: 4 })
    tableSession.clear()
    expect(tableSession.get()).toBeNull()
  })

  it('ignore une valeur corrompue', () => {
    sessionStorage.setItem('resto.table', '{pas du json')
    expect(tableSession.get()).toBeNull()
    sessionStorage.setItem('resto.table', JSON.stringify({ code: 12 }))
    expect(tableSession.get()).toBeNull()
  })

  it('valide le format GUID du code', () => {
    expect(isValidTableCode('11111111-1111-4111-8111-111111111111')).toBe(true)
    expect(isValidTableCode('table-1')).toBe(false)
    expect(isValidTableCode('')).toBe(false)
  })
})
