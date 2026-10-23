import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  audioStatus,
  playAlert,
  resetAudioForTests,
  soundPreference,
  unlockAudio,
} from './alertSound'

class FakeAudioContext {
  state: 'suspended' | 'running' = 'suspended'
  currentTime = 0
  destination = {}
  oscillators = 0
  resume() {
    this.state = 'running'
    return Promise.resolve()
  }
  createOscillator = () => {
    this.oscillators++
    return {
      type: '',
      frequency: { value: 0 },
      connect: (node: unknown) => node,
      start: vi.fn(),
      stop: vi.fn(),
    }
  }
  createGain = () => ({
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: (node: unknown) => node,
  })
}

describe('préférence du son', () => {
  it('activé par défaut, mémorisé quand on le coupe', () => {
    expect(soundPreference.get()).toBe(true)
    soundPreference.set(false)
    expect(soundPreference.get()).toBe(false)
    expect(localStorage.getItem('resto.admin.sound')).toBe('off')
    soundPreference.set(true)
    expect(soundPreference.get()).toBe(true)
  })
})

describe('Web Audio', () => {
  const original = window.AudioContext

  beforeEach(() => resetAudioForTests())
  afterEach(() => {
    window.AudioContext = original
    resetAudioForTests()
  })

  it("sans geste de l'utilisateur, le son est bloqué (locked) et rien n'est joué", () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext
    expect(audioStatus()).toBe('locked')
    expect(playAlert()).toBe(false)
  })

  it('après unlockAudio (clic), le carillon à deux notes est joué', async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext
    expect(await unlockAudio()).toBe('ready')
    expect(audioStatus()).toBe('ready')
    expect(playAlert()).toBe(true)
  })

  it('navigateur sans Web Audio : unsupported, aucune erreur', async () => {
    // @ts-expect-error simulation d'un navigateur sans Web Audio
    window.AudioContext = undefined
    expect(audioStatus()).toBe('unsupported')
    expect(await unlockAudio()).toBe('unsupported')
    expect(playAlert()).toBe(false)
  })
})
