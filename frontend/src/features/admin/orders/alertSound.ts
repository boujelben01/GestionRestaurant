import { useCallback, useState } from 'react'

const PREF_KEY = 'resto.admin.sound'

/** Préférence « son activé » (par défaut activé), mémorisée dans localStorage. */
export const soundPreference = {
  get(): boolean {
    try {
      return localStorage.getItem(PREF_KEY) !== 'off'
    } catch {
      return true
    }
  },
  set(enabled: boolean) {
    try {
      localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off')
    } catch {
      /* stockage indisponible : la préférence vaut pour la session */
    }
  },
}

type AudioContextCtor = typeof AudioContext

function audioCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  )
}

let context: AudioContext | null = null

export type AudioStatus = 'unsupported' | 'locked' | 'ready'

/** « locked » : les navigateurs exigent un geste de l'utilisateur avant d'autoriser le son. */
export function audioStatus(): AudioStatus {
  if (!audioCtor()) return 'unsupported'
  return context?.state === 'running' ? 'ready' : 'locked'
}

/** À appeler depuis un clic : crée / reprend le contexte audio (autorisation du navigateur). */
export async function unlockAudio(): Promise<AudioStatus> {
  const Ctor = audioCtor()
  if (!Ctor) return 'unsupported'
  try {
    context ??= new Ctor()
    if (context.state === 'suspended') await context.resume()
  } catch {
    return 'locked'
  }
  return audioStatus()
}

/**
 * Carillon à deux notes généré par Web Audio (aucun fichier). Retourne false si le navigateur
 * bloque le son (pas encore de geste de l'utilisateur) ou ne le supporte pas.
 */
export function playAlert(): boolean {
  if (audioStatus() !== 'ready' || !context) return false
  const ctx = context
  const start = ctx.currentTime
  ;[
    { frequency: 880, offset: 0 },
    { frequency: 1174.66, offset: 0.18 },
  ].forEach(({ frequency, offset }) => {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, start + offset)
    gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.35)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(start + offset)
    oscillator.stop(start + offset + 0.4)
  })
  return true
}

/** Réinitialise le contexte (tests). */
export function resetAudioForTests() {
  context = null
}

/** État réactif du bouton « son » : activé/coupé (mémorisé) et autorisation du navigateur. */
export function useAlertSound() {
  const [enabled, setEnabledState] = useState(soundPreference.get)
  const [status, setStatus] = useState<AudioStatus>(audioStatus)

  const setEnabled = useCallback(async (value: boolean) => {
    soundPreference.set(value)
    setEnabledState(value)
    // Le clic qui active le son sert aussi de geste d'autorisation pour le navigateur.
    if (value) setStatus(await unlockAudio())
  }, [])

  const unlock = useCallback(async () => setStatus(await unlockAudio()), [])

  /** Joue le carillon si le son est activé et autorisé ; renvoie true si entendu. */
  const play = useCallback(() => (soundPreference.get() ? playAlert() : false), [])

  return { enabled, status, setEnabled, unlock, play }
}
