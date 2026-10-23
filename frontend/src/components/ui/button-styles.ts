import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold ' +
  'transition-[background-color,color,border-color,transform] duration-200 ease-out-soft ' +
  'active:scale-[0.97] aria-disabled:pointer-events-none aria-disabled:opacity-55 disabled:pointer-events-none disabled:opacity-55'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-terracotta-600 text-white shadow-soft hover:bg-terracotta-700',
  secondary: 'bg-ink-900 text-sand-50 hover:bg-ink-700',
  outline:
    'border-[1.5px] border-ink-900/25 bg-transparent text-ink-900 hover:border-ink-900 hover:bg-sand-100',
  ghost: 'bg-transparent text-ink-900 hover:bg-sand-200/70',
  danger: 'bg-danger-600 text-white hover:bg-danger-800',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-4 text-sm',
  md: 'min-h-11 px-6 text-base',
  lg: 'min-h-14 px-8 text-base',
}

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  fullWidth = false,
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)
}
