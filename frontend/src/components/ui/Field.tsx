import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { AlertIcon } from './icons'

/** Attributs à répartir sur le contrôle pour le relier à son libellé, son aide et son erreur. */
export interface FieldControlProps {
  id: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
  'aria-required': true | undefined
}

interface FieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  /** Indique « (facultatif) » à côté du libellé. */
  optional?: boolean
  className?: string
  children: (control: FieldControlProps) => ReactNode
}

/** Enveloppe libellé + aide + message d'erreur ; le contrôle est fourni en render-prop. */
export function Field({ label, hint, error, required, optional, className, children }: FieldProps) {
  const { t } = useTranslation()
  const uid = useId()
  const id = `field-${uid}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-800">
        {label}
        {optional && (
          <span className="ms-1.5 font-normal text-ink-500">({t('common.optional')})</span>
        )}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="text-sm text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger-600">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

interface InputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'id'> {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  /** Contenu superposé au bout du champ (ex. bouton afficher/masquer). Réserve 3rem. */
  endAdornment?: ReactNode
  /** Force la saisie en LTR (email, téléphone, identifiants) tout en gardant l'alignement miroir. */
  ltr?: boolean
  wrapperClassName?: string
}

/** Champ texte complet : libellé, aide, erreur, ARIA câblé. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    optional,
    required,
    endAdornment,
    ltr,
    className,
    wrapperClassName,
    ...props
  },
  ref,
) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      className={wrapperClassName}
    >
      {(control) => (
        <div className="relative">
          <input
            ref={ref}
            required={required}
            dir={ltr ? 'ltr' : undefined}
            {...control}
            {...props}
            className={cn(
              'block min-h-12 w-full rounded-md border-[1.5px] bg-white px-4 text-base text-ink-900 ' +
                'transition-colors duration-200 placeholder:text-ink-300 hover:border-ink-500',
              ltr && 'text-start rtl:text-end',
              error ? 'border-danger-600' : 'border-sand-400',
              !!endAdornment && 'pe-12',
              className,
            )}
          />
          {endAdornment && (
            <div className="absolute inset-y-0 end-0 flex items-center pe-0.5">{endAdornment}</div>
          )}
        </div>
      )}
    </Field>
  )
})
