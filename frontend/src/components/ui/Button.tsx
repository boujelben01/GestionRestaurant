import { forwardRef, type ComponentPropsWithoutRef, type ReactNode, type Ref } from 'react'
import { Link } from 'react-router-dom'
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-styles'

interface ButtonOwnProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Affiche un spinner et bloque les interactions (aria-busy). */
  loading?: boolean
  fullWidth?: boolean
  /** Icône avant le libellé (placée au début de ligne, donc miroir en RTL). */
  icon?: ReactNode
  /** Navigation interne (react-router) : rend un <a>. */
  to?: string
  /** Lien externe / tel: / mailto: : rend un <a>. */
  href?: string
  replace?: boolean
  state?: unknown
}

export type ButtonProps = ButtonOwnProps &
  Omit<ComponentPropsWithoutRef<'button'>, keyof ButtonOwnProps> &
  Omit<ComponentPropsWithoutRef<'a'>, keyof ButtonOwnProps | 'type'>

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 animate-spin-slow"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Bouton polymorphe : <button>, <Link> (prop `to`) ou <a> (prop `href`). */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      icon,
      to,
      href,
      replace,
      state,
      className,
      children,
      disabled,
      ...rest
    },
    ref,
  ) {
    const classes = buttonClasses(variant, size, fullWidth, className)
    const content = (
      <>
        {loading ? <Spinner /> : icon}
        {children}
      </>
    )

    if (to !== undefined || href !== undefined) {
      const inactive = disabled || loading
      const anchorProps = {
        ...(rest as ComponentPropsWithoutRef<'a'>),
        className: classes,
        'aria-disabled': inactive || undefined,
        'aria-busy': loading || undefined,
        tabIndex: inactive ? -1 : undefined,
      }
      return to !== undefined ? (
        <Link
          ref={ref as Ref<HTMLAnchorElement>}
          to={to}
          replace={replace}
          state={state}
          {...anchorProps}
        >
          {content}
        </Link>
      ) : (
        <a ref={ref as Ref<HTMLAnchorElement>} href={href} {...anchorProps}>
          {content}
        </a>
      )
    }

    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        {...(rest as ComponentPropsWithoutRef<'button'>)}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
      >
        {content}
      </button>
    )
  },
)
