import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertIcon, Button, Input } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  PRESETS,
  detectPreset,
  presetPeriod,
  validateCustom,
  type Period,
  type PeriodPreset,
} from './period'

interface PeriodPickerProps {
  period: Period
  today: string
  /** Période de l'adresse invalide : bandeau discret. */
  invalid: boolean
  onChange: (period: Period) => void
}

/**
 * Sélecteur de période : 7 / 30 / 90 jours (radiogroup) ou personnalisée (du / au + Appliquer, validés).
 * La période elle-même vit dans l'URL (gérée par la page).
 */
export function PeriodPicker({ period, today, invalid, onChange }: PeriodPickerProps) {
  const { t } = useTranslation()
  const detected = detectPreset(period, today)
  const [customOpen, setCustomOpen] = useState(false)
  const [du, setDu] = useState(period.du)
  const [au, setAu] = useState(period.au)
  const [error, setError] = useState<string>()

  const selected: PeriodPreset = customOpen ? 'custom' : detected
  const options: Array<{ value: PeriodPreset; label: string }> = [
    ...PRESETS.map((d) => ({
      value: `${d}` as PeriodPreset,
      label: t('admin.stats.lastDays', { count: d }),
    })),
    { value: 'custom', label: t('admin.stats.custom') },
  ]

  const choose = (value: PeriodPreset) => {
    if (value === 'custom') {
      setDu(period.du)
      setAu(period.au)
      setCustomOpen(true)
      return
    }
    setCustomOpen(false)
    setError(undefined)
    onChange(presetPeriod(Number(value), today))
  }

  const apply = (event: FormEvent) => {
    event.preventDefault()
    const code = validateCustom(du, au)
    if (code) {
      setError(t(`admin.stats.periodErrors.${code}`))
      return
    }
    setError(undefined)
    setCustomOpen(false)
    onChange({ du, au })
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={t('admin.stats.period')} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              name="period"
              value={option.value}
              checked={selected === option.value}
              onChange={() => choose(option.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors',
                'border-sand-400 bg-white text-ink-700 hover:border-ink-500',
                'peer-checked:border-ink-900 peer-checked:bg-ink-900 peer-checked:text-sand-50',
                'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sidi-600',
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>

      {customOpen && (
        <form
          onSubmit={apply}
          noValidate
          className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-soft"
        >
          <Input
            type="date"
            name="du"
            label={t('admin.stats.from')}
            value={du}
            onChange={(event) => setDu(event.target.value)}
            ltr
            wrapperClassName="w-44"
          />
          <Input
            type="date"
            name="au"
            label={t('admin.stats.to')}
            value={au}
            onChange={(event) => setAu(event.target.value)}
            ltr
            wrapperClassName="w-44"
          />
          <Button type="submit">{t('admin.stats.apply')}</Button>
          {error && (
            <p
              role="alert"
              className="flex w-full items-start gap-2 text-sm font-medium text-danger-800"
            >
              <AlertIcon className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
        </form>
      )}

      {invalid && (
        <p role="status" className="text-sm text-ink-700">
          {t('admin.stats.invalidUrl')}
        </p>
      )}
    </div>
  )
}
