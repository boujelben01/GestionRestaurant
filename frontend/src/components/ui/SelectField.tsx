import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/cn'
import { Field } from './Field'

interface SelectFieldProps extends Omit<ComponentPropsWithoutRef<'select'>, 'id'> {
  label: string
  hint?: string
  error?: string
  wrapperClassName?: string
}

/** Liste déroulante native avec libellé, aide et erreur câblés (aria). */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, required, className, wrapperClassName, children, ...props },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      {(control) => (
        <select
          ref={ref}
          required={required}
          {...control}
          {...props}
          className={cn(
            'block min-h-12 w-full rounded-md border-[1.5px] bg-white px-3 text-base text-ink-900 transition-colors duration-200 hover:border-ink-500',
            error ? 'border-danger-600' : 'border-sand-400',
            className,
          )}
        >
          {children}
        </select>
      )}
    </Field>
  )
})
