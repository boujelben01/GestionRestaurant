import { describe, expect, it } from 'vitest'
import type { Horaire } from '@/lib/types'
import {
  buildHorairesRequest,
  buildSettingsRequest,
  daysAreValid,
  isOvernight,
  toDayForms,
  validateDay,
  validateSettings,
  type SettingsFormValues,
} from './validation'

const settings: SettingsFormValues = {
  nom: 'Resto',
  telephone: '+216 71 000 000',
  email: 'contact@resto.tn',
  adresse: 'Avenue Habib Bourguiba, Tunis',
  fraisLivraison: '3,5',
  montantMinimumLivraison: '20',
}

describe('paramètres du restaurant', () => {
  it('valide un formulaire complet', () => {
    expect(validateSettings(settings)).toEqual({})
    expect(buildSettingsRequest(settings)).toMatchObject({
      fraisLivraison: 3.5,
      montantMinimumLivraison: 20,
    })
  })

  it('exige les champs et contrôle e-mail, téléphone et montants', () => {
    const errors = validateSettings({
      nom: '',
      telephone: 'abc',
      email: 'pas-un-email',
      adresse: '',
      fraisLivraison: '-1',
      montantMinimumLivraison: '1,234',
    })
    expect(errors).toEqual({
      nom: 'required',
      telephone: 'phone',
      email: 'email',
      adresse: 'required',
      fraisLivraison: 'priceNegative',
      montantMinimumLivraison: 'priceDecimals',
    })
  })

  it('limite les longueurs', () => {
    expect(validateSettings({ ...settings, adresse: 'x'.repeat(301) }).adresse).toBe('tooLong')
    expect(validateSettings({ ...settings, nom: 'x'.repeat(101) }).nom).toBe('tooLong')
  })
})

describe('horaires', () => {
  const horaires: Horaire[] = [
    { jourSemaine: 1, ouverture: '11:00', fermeture: '23:00', estFerme: false },
    { jourSemaine: 5, ouverture: '18:00', fermeture: '02:00', estFerme: false },
    { jourSemaine: 0, ouverture: null, fermeture: null, estFerme: true },
  ]

  it('produit toujours 7 jours, ceux qui manquent sont fermés', () => {
    const days = toDayForms(horaires)
    expect(days).toHaveLength(7)
    expect(days.map((d) => d.jourSemaine)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(days[2]?.estFerme).toBe(true)
  })

  it('signale la fermeture après minuit', () => {
    const days = toDayForms(horaires)
    expect(isOvernight(days[5]!)).toBe(true)
    expect(isOvernight(days[1]!)).toBe(false)
    expect(isOvernight(days[0]!)).toBe(false)
  })

  it('valide HH:mm, exige les deux heures et refuse ouverture = fermeture', () => {
    const day = { jourSemaine: 1, estFerme: false, ouverture: '11:00', fermeture: '23:00' }
    expect(validateDay(day)).toEqual({})
    expect(validateDay({ ...day, ouverture: '' })).toEqual({ ouverture: 'required' })
    expect(validateDay({ ...day, fermeture: '24:00' })).toEqual({ fermeture: 'format' })
    expect(validateDay({ ...day, ouverture: '9:00' })).toEqual({ ouverture: 'format' })
    expect(validateDay({ ...day, fermeture: '11:00' })).toEqual({ fermeture: 'same' })
  })

  it("un jour fermé n'a besoin d'aucune heure et n'en envoie pas", () => {
    const closed = { jourSemaine: 0, estFerme: true, ouverture: 'n importe quoi', fermeture: '' }
    expect(validateDay(closed)).toEqual({})
    expect(daysAreValid([closed])).toBe(true)
    expect(buildHorairesRequest([closed]).horaires[0]).toEqual({
      jourSemaine: 0,
      estFerme: true,
      ouverture: null,
      fermeture: null,
    })
  })
})
