import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/lib/i18n'
import type { MenuArticle } from '@/lib/types'
import { ArticleCard } from './ArticleCard'
import { FALLBACK_IMAGE } from './images'

const base: MenuArticle = {
  id: 1,
  categorieId: 1,
  nom: 'Brik au thon',
  description: 'Croustillant',
  prix: 3.5,
  imageUrl: '/images/lablabi.webp',
  estPopulaire: false,
  disponible: true,
}

function setup(overrides: Partial<MenuArticle> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ArticleCard article={{ ...base, ...overrides }} />
    </I18nextProvider>,
  )
}

describe('ArticleCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr')
  })

  it('affiche nom, description, prix en DT et image avec dimensions', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Brik au thon' })).toBeInTheDocument()
    expect(screen.getByText('Croustillant')).toBeInTheDocument()
    expect(screen.getByText(/3,50/)).toBeInTheDocument()
    const img = screen.getByAltText('Brik au thon')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('width')
    expect(img).toHaveAttribute('height')
  })

  it('affiche le badge Populaire une seule fois', () => {
    setup({ estPopulaire: true })
    expect(screen.getAllByText('Populaire')).toHaveLength(1)
  })

  it('sans popularité, pas de badge', () => {
    setup()
    expect(screen.queryByText('Populaire')).not.toBeInTheDocument()
  })

  it('un article indisponible reste visible, grisé et signalé', () => {
    setup({ disponible: false })
    expect(screen.getByText('Indisponible')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Brik au thon' })).toBeInTheDocument()
    expect(screen.getByAltText('Brik au thon').className).toContain('grayscale')
  })

  it('le bouton Ajouter est visible mais désactivé', () => {
    setup()
    expect(screen.getByRole('button', { name: /Ajouter Brik au thon/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it("replie sur default.svg quand l'image est absente", () => {
    setup({ imageUrl: null })
    expect(screen.getByAltText('Brik au thon').getAttribute('src')).toBe(FALLBACK_IMAGE)
  })

  it('replie sur default.svg pour une photo trop lourde', () => {
    setup({ imageUrl: '/images/chawarma.jpg' })
    expect(screen.getByAltText('Brik au thon').getAttribute('src')).toBe(FALLBACK_IMAGE)
  })

  it('replie sur default.svg quand le chargement échoue', () => {
    setup({ imageUrl: '/images/inexistante.png' })
    const img = screen.getByAltText('Brik au thon')
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe(FALLBACK_IMAGE)
  })
})
