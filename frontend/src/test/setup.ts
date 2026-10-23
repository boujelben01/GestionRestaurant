import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Les pages sont chargées en lazy : la première transformation peut dépasser 1 s.
configure({ asyncUtilTimeout: 5000 })

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// jsdom n'implémente pas matchMedia ni IntersectionObserver (utilisés par motion / scroll-spy).
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

if (!('IntersectionObserver' in window)) {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  Object.defineProperty(window, 'IntersectionObserver', { value: IO })
}

window.scrollTo = (() => {}) as typeof window.scrollTo

// jsdom n'implémente pas le défilement d'éléments (barre de catégories du menu).
Element.prototype.scrollBy ??= (() => {}) as typeof Element.prototype.scrollBy
Element.prototype.scrollTo ??= (() => {}) as typeof Element.prototype.scrollTo
Element.prototype.scrollIntoView ??= (() => {}) as typeof Element.prototype.scrollIntoView
