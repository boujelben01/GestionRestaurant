import { describe, expect, it } from 'vitest'
import type { AdminTable } from '@/lib/types'
import {
  DEFAULT_PUBLIC_URL,
  isLocalAddress,
  printableTables,
  publicBaseUrl,
  qrDataUri,
  tableQrUrl,
} from './qr'

const CODE = '11111111-1111-4111-8111-111111111111'

describe('URL encodée dans le QR', () => {
  it("ajoute /table/<code> à l'adresse du site", () => {
    expect(tableQrUrl('https://resto.example.tn', CODE)).toBe(
      `https://resto.example.tn/table/${CODE}`,
    )
  })

  it('un slash final (ou plusieurs) ne produit pas de double slash', () => {
    expect(tableQrUrl('https://resto.example.tn/', CODE)).toBe(
      `https://resto.example.tn/table/${CODE}`,
    )
    expect(tableQrUrl('https://resto.example.tn///', CODE)).toBe(
      `https://resto.example.tn/table/${CODE}`,
    )
    expect(tableQrUrl(' https://resto.example.tn/ ', CODE)).toBe(
      `https://resto.example.tn/table/${CODE}`,
    )
  })

  it('conserve un sous-chemin', () => {
    expect(tableQrUrl('https://example.tn/resto/', CODE)).toBe(
      `https://example.tn/resto/table/${CODE}`,
    )
  })

  it('VITE_PUBLIC_URL : valeur lue, slash final retiré, défaut de développement si absente ou vide', () => {
    expect(publicBaseUrl('https://resto.example.tn/')).toBe('https://resto.example.tn')
    expect(publicBaseUrl('  https://resto.example.tn  ')).toBe('https://resto.example.tn')
    expect(publicBaseUrl(undefined)).toBe(DEFAULT_PUBLIC_URL)
    expect(publicBaseUrl('')).toBe(DEFAULT_PUBLIC_URL)
    expect(publicBaseUrl('   ')).toBe(DEFAULT_PUBLIC_URL)
  })
})

describe('avertissement « adresse locale »', () => {
  it.each([
    'http://localhost:5173',
    'http://LOCALHOST',
    'https://localhost/table/x',
    'http://127.0.0.1:5173',
    'http://[::1]:5173',
    'http://0.0.0.0:5173',
  ])('%s est une adresse locale', (url) => expect(isLocalAddress(url)).toBe(true))

  it.each([
    'https://resto.example.tn',
    'https://www.chez-sami.tn/resto',
    'http://192.168.1.20:5173', // réseau local, mais pas « localhost » : non signalé
  ])("%s n'est pas signalée", (url) => expect(isLocalAddress(url)).toBe(false))
})

describe('impression', () => {
  const table = (id: number, numero: number, estActive: boolean): AdminTable => ({
    id,
    numero,
    code: `${id}`.padStart(8, '0') + '-0000-4000-8000-000000000000',
    capacite: 4,
    estActive,
  })

  it('ne contient que les tables actives, triées par numéro', () => {
    const tables = [table(1, 5, true), table(2, 2, false), table(3, 3, true), table(4, 1, true)]

    const printable = printableTables(tables)

    expect(printable.map((t) => t.numero)).toEqual([1, 3, 5])
    expect(printable.some((t) => !t.estActive)).toBe(false)
    expect(tables.map((t) => t.numero)).toEqual([5, 2, 3, 1]) // la liste d'origine n'est pas modifiée
  })

  it('aucune table active : rien à imprimer', () => {
    expect(printableTables([table(1, 1, false)])).toEqual([])
    expect(printableTables([])).toEqual([])
  })
})

describe('génération du QR code (dans le navigateur, sans service externe)', () => {
  it('produit une image SVG noir sur blanc en data URI', async () => {
    const uri = await qrDataUri(`https://resto.example.tn/table/${CODE}`)

    expect(uri.startsWith('data:image/svg+xml;utf8,')).toBe(true)
    const svg = decodeURIComponent(uri.replace('data:image/svg+xml;utf8,', ''))
    expect(svg).toContain('<svg')
    expect(svg.toLowerCase()).toContain('#000000')
    expect(svg.toLowerCase()).toContain('#ffffff')
  })

  it('deux codes différents donnent deux QR différents', async () => {
    const a = await qrDataUri(tableQrUrl('https://resto.example.tn', CODE))
    const b = await qrDataUri(
      tableQrUrl('https://resto.example.tn', '55555555-5555-4555-8555-555555555555'),
    )
    expect(a).not.toBe(b)
  })
})
