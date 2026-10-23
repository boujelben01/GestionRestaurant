import { useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertIcon, Card, EyeIcon, EyeOffIcon, Input, ZelligePattern } from '@/components/ui'

/** Cadre commun des écrans d'authentification : carte centrée sur fond de carreaux atténué. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="relative isolate flex flex-1 items-start justify-center overflow-hidden px-4 py-10 sm:items-center sm:py-16">
      <ZelligePattern className="-z-10 text-terracotta-600 opacity-[0.07]" size={72} />
      <Card className="w-full max-w-md overflow-hidden rounded-xl">
        <div
          className="h-1.5 bg-linear-to-r from-terracotta-600 via-gold-400 to-sidi-600"
          aria-hidden="true"
        />
        <div className="p-6 sm:p-8">
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
          <p className="mt-2 text-ink-700">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
        <div className="border-t border-sand-200 bg-sand-100/70 px-6 py-4 text-center text-sm text-ink-700 sm:px-8">
          {footer}
        </div>
      </Card>
    </div>
  )
}

/** Alerte générale d'un formulaire (annoncée par role="alert"). */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-3 rounded-md border border-danger-600/30 bg-danger-100 p-4 text-sm font-medium text-danger-800"
    >
      <AlertIcon className="mt-0.5 size-5 shrink-0" />
      <p>{children}</p>
    </div>
  )
}

type PasswordInputProps = Omit<
  ComponentPropsWithoutRef<typeof Input>,
  'type' | 'endAdornment' | 'ltr'
>

/** Champ mot de passe avec bouton afficher/masquer (aria-pressed + libellé explicite). */
export function PasswordInput(props: PasswordInputProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  return (
    <Input
      {...props}
      ltr
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      spellCheck={false}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? t('a11y.hidePassword') : t('a11y.showPassword')}
          className="grid size-11 place-items-center rounded-full text-ink-700 transition-colors hover:bg-sand-200"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  )
}
