import { describe, expect, it } from 'vitest'
import { canToggleUser, isSelf } from './rules'

describe('un administrateur ne peut pas se désactiver lui-même', () => {
  it('reconnaît sa propre ligne', () => {
    expect(isSelf({ id: 'u-admin' }, 'u-admin')).toBe(true)
    expect(isSelf({ id: 'u-client' }, 'u-admin')).toBe(false)
  })

  it('le bouton est désactivé sur soi-même, actif sur les autres', () => {
    expect(canToggleUser({ id: 'u-admin' }, 'u-admin')).toBe(false)
    expect(canToggleUser({ id: 'u-client' }, 'u-admin')).toBe(true)
  })

  it("profil pas encore chargé : on ne peut pas dire que c'est soi, mais rien n'est cassé", () => {
    expect(isSelf({ id: 'u-admin' }, undefined)).toBe(false)
  })
})
