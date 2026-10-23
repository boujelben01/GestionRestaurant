import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it } from 'vitest'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import i18n, { LANG_STORAGE_KEY, currentLang, normalizeLang } from '.'
import ar from './locales/ar.json'
import fr from './locales/fr.json'

function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object'
      ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  )
}

describe('bascule de langue', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr')
  })

  it('met à jour <html lang dir> : rtl en arabe, ltr en français', async () => {
    await i18n.changeLanguage('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(currentLang()).toBe('ar')
    await i18n.changeLanguage('fr')
    expect(document.documentElement.lang).toBe('fr')
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('le sélecteur change la langue, le dir et mémorise le choix', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>,
    )
    expect(screen.getByRole('button', { name: 'Français' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
    expect(document.documentElement.dir).toBe('rtl')
    expect(screen.getByRole('button', { name: 'العربية' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('ar')
  })

  it('normalise les codes de langue', () => {
    expect(normalizeLang('ar-TN')).toBe('ar')
    expect(normalizeLang('fr-FR')).toBe('fr')
    expect(normalizeLang('en')).toBe('fr')
    expect(normalizeLang(undefined)).toBe('fr')
  })

  it('fr.json et ar.json ont exactement les mêmes clés (hors pluriels)', () => {
    const base = (list: string[]) =>
      new Set(list.map((k) => k.replace(/_(zero|one|two|few|many|other)$/, '')))
    expect([...base(keys(fr))].sort()).toEqual([...base(keys(ar))].sort())
  })
})
