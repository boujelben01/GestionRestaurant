import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '.'

describe('langue unique (français)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr')
  })

  it('met <html lang dir> en fr / ltr, même si une autre langue est demandée', async () => {
    await i18n.changeLanguage('ar')
    expect(document.documentElement.lang).toBe('fr')
    expect(document.documentElement.dir).toBe('ltr')
  })
})
