import { beforeEach, describe, expect, it } from 'vitest'
import i18n, { LANG_STORAGE_KEY, applyFavoriteLang, setExplicitLang } from '.'

describe('langue favorite du profil', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('fr')
  })

  it("est appliquée à la connexion si aucune langue n'a été choisie", () => {
    applyFavoriteLang('ar')
    expect(i18n.language).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
  })

  it("ne remplace pas un choix explicite de l'utilisateur", async () => {
    await setExplicitLang('fr')
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('fr')
    applyFavoriteLang('ar')
    expect(i18n.language).toBe('fr')
  })

  it('ignore une valeur absente', () => {
    applyFavoriteLang(undefined)
    expect(i18n.language).toBe('fr')
  })
})
