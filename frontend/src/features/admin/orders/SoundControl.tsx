import { useTranslation } from 'react-i18next'
import { BellIcon, BellOffIcon, Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { useAlertSound } from './alertSound'

type Sound = ReturnType<typeof useAlertSound>

/**
 * Bouton « Son » : activer/couper (mémorisé). Si le navigateur bloque encore le son (aucun geste),
 * un bouton visible explique comment l'autoriser ; le clic sert de geste d'autorisation.
 */
export function SoundControl({ sound }: { sound: Sound }) {
  const { t } = useTranslation()
  const locked = sound.enabled && sound.status === 'locked'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={sound.enabled}
        onClick={() => void sound.setEnabled(!sound.enabled)}
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors',
          sound.enabled
            ? 'border-olive-700 bg-olive-100 text-olive-700'
            : 'border-sand-400 bg-white text-ink-700',
        )}
      >
        {sound.enabled ? <BellIcon className="size-5" /> : <BellOffIcon className="size-5" />}
        {sound.enabled ? t('admin.sound.on') : t('admin.sound.off')}
      </button>
      {locked && (
        <Button variant="primary" size="sm" onClick={() => void sound.unlock()}>
          {t('admin.sound.unlock')}
        </Button>
      )}
      {sound.enabled && sound.status === 'unsupported' && (
        <p className="text-sm text-ink-700">{t('admin.sound.unsupported')}</p>
      )}
    </div>
  )
}
