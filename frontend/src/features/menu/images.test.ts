import { describe, expect, it } from 'vitest'
import { FALLBACK_IMAGE, resolveImage } from './images'

describe('resolveImage', () => {
  it('garde une image légère', () => {
    expect(resolveImage('/images/lablabi.webp')).toBe('/images/lablabi.webp')
  })

  it("replie sur default.svg quand il n'y a pas d'image", () => {
    expect(resolveImage(null)).toBe(FALLBACK_IMAGE)
    expect(resolveImage('')).toBe(FALLBACK_IMAGE)
  })

  it("n'affiche jamais les photos de 6-7 Mo", () => {
    expect(resolveImage('/images/chawarma.jpg')).toBe(FALLBACK_IMAGE)
    expect(resolveImage('/images/assiette-chawarma.jpg')).toBe(FALLBACK_IMAGE)
  })
})
