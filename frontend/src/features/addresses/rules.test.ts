import { describe, expect, it } from 'vitest'
import type { Address } from '@/lib/types'
import {
  EMPTY_ADDRESS,
  MAX_ADDRESSES,
  applyDefault,
  buildAddressRequest,
  canAddAddress,
  checkoutPrefill,
  defaultAddress,
  deliveryLine,
  toFormValues,
  validateAddress,
  type AddressFormValues,
} from './rules'

const valid: AddressFormValues = {
  libelle: 'Maison',
  ligne: '12 rue de la Liberté',
  ville: 'Tunis',
  details: '',
  telephone: '+216 20 123 456',
  estParDefaut: false,
}

const address = (id: number, over: Partial<Address> = {}): Address => ({
  id,
  libelle: `A${id}`,
  ligne: '12 rue de la Liberté',
  ville: 'Tunis',
  details: null,
  telephone: '+21620123456',
  estParDefaut: false,
  ...over,
})

describe("validation du formulaire d'adresse", () => {
  it('une adresse complète est valide', () => {
    expect(validateAddress(valid)).toEqual({})
  })

  it('exige libellé, ligne, ville et téléphone (espaces seuls refusés)', () => {
    expect(validateAddress({ ...EMPTY_ADDRESS })).toEqual({
      libelle: 'required',
      ligne: 'required',
      ville: 'required',
      telephone: 'required',
    })
    expect(validateAddress({ ...valid, libelle: '   ' }).libelle).toBe('required')
  })

  it.each([
    ['libelle', 51],
    ['ligne', 201],
    ['ville', 101],
    ['details', 301],
  ] as const)('%s : %d caractères refusés, la limite exacte est acceptée', (field, tooLong) => {
    expect(validateAddress({ ...valid, [field]: 'x'.repeat(tooLong) })[field]).toBe('tooLong')
    expect(validateAddress({ ...valid, [field]: 'x'.repeat(tooLong - 1) })[field]).toBeUndefined()
  })

  it('téléphone : format et 20 caractères au plus', () => {
    expect(validateAddress({ ...valid, telephone: 'abc' }).telephone).toBe('phone')
    expect(validateAddress({ ...valid, telephone: '1'.repeat(21) }).telephone).toBe('tooLong')
    expect(validateAddress({ ...valid, telephone: '20 123 456' }).telephone).toBeUndefined()
  })

  it('les détails sont facultatifs', () => {
    expect(validateAddress({ ...valid, details: '' }).details).toBeUndefined()
  })
})

describe('corps de requête', () => {
  it('rogne les valeurs et envoie des détails vides comme null', () => {
    expect(
      buildAddressRequest({
        ...valid,
        libelle: '  Maison ',
        details: '   ',
        telephone: ' +21620123456 ',
      }),
    ).toEqual({
      libelle: 'Maison',
      ligne: '12 rue de la Liberté',
      ville: 'Tunis',
      details: null,
      telephone: '+21620123456',
      estParDefaut: false,
    })
  })

  it('aller-retour avec le formulaire', () => {
    const a = address(1, { details: '2e étage', estParDefaut: true })
    expect(buildAddressRequest(toFormValues(a))).toMatchObject({
      details: '2e étage',
      estParDefaut: true,
    })
    expect(toFormValues(address(2)).details).toBe('')
  })
})

describe('limite et défaut', () => {
  it('10 adresses au plus', () => {
    expect(MAX_ADDRESSES).toBe(10)
    expect(canAddAddress(9)).toBe(true)
    expect(canAddAddress(10)).toBe(false)
  })

  it("l'adresse par défaut, sinon la première", () => {
    expect(defaultAddress([address(1), address(2, { estParDefaut: true })])?.id).toBe(2)
    expect(defaultAddress([address(3), address(4)])?.id).toBe(3)
    expect(defaultAddress([])).toBeUndefined()
  })

  it('« définir par défaut » : une seule défaut, placée en premier', () => {
    const next = applyDefault([address(1, { estParDefaut: true }), address(2), address(3)], 3)
    expect(next.map((a) => a.id)).toEqual([3, 1, 2])
    expect(next.filter((a) => a.estParDefaut).map((a) => a.id)).toEqual([3])
  })
})

describe('préremplissage de la livraison', () => {
  it('compose « ligne, ville, détails » et reprend le téléphone', () => {
    const a = address(1, { details: 'Bâtiment B, 2e étage' })
    expect(deliveryLine(a)).toBe('12 rue de la Liberté, Tunis, Bâtiment B, 2e étage')
    expect(checkoutPrefill(a)).toEqual({
      adresse: '12 rue de la Liberté, Tunis, Bâtiment B, 2e étage',
      telephone: '+21620123456',
    })
  })

  it('sans détails, pas de virgule superflue', () => {
    expect(deliveryLine(address(1))).toBe('12 rue de la Liberté, Tunis')
    expect(deliveryLine({ ligne: ' 5 rue A ', ville: ' Sfax ', details: '  ' })).toBe(
      '5 rue A, Sfax',
    )
  })
})
