import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { Button, Input, useToast } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { AuthLayout, FormAlert, PasswordInput } from '@/features/auth/AuthLayout'
import { describeFormError, safeRedirect } from '@/features/auth/authErrors'
import { validateRegister, type FieldErrors } from '@/features/auth/validation'

type Field = 'nom' | 'email' | 'password' | 'telephone'
const FIELDS = ['nom', 'email', 'password', 'telephone'] as const
const PASSWORD_MIN = 8

export default function Register() {
  const { t } = useTranslation()
  const { register, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const location = useLocation()
  const from = safeRedirect((location.state as { from?: unknown } | null)?.from)

  const [values, setValues] = useState({ nom: '', email: '', password: '', telephone: '' })
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [general, setGeneral] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) return <Navigate to={from} replace />

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target as HTMLInputElement & { name: Field }
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const focusFirst = (form: HTMLFormElement, failed: FieldErrors<Field>) => {
    const key = FIELDS.find((field) => failed[field])
    if (key) (form.elements.namedItem(key) as HTMLElement | null)?.focus()
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const clientErrors = validateRegister(values, t)
    setErrors(clientErrors)
    setGeneral(undefined)
    if (Object.keys(clientErrors).length > 0) {
      focusFirst(form, clientErrors)
      return
    }

    setSubmitting(true)
    try {
      const user = await register({
        nom: values.nom.trim(),
        email: values.email.trim(),
        password: values.password,
        telephone: values.telephone.trim() || undefined,
        langueFavorite: 'fr',
      })
      toast(t('auth.welcome', { name: user.nom?.trim() || user.userName }), { variant: 'success' })
    } catch (error) {
      const failure = describeFormError(error, t, FIELDS, 'register')
      setErrors(failure.fields)
      setGeneral(failure.general)
      focusFirst(form, failure.fields)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Seo title={t('seo.registerTitle')} description={t('seo.registerDescription')} noindex />
      <AuthLayout
        title={t('auth.register.title')}
        subtitle={t('auth.register.subtitle')}
        footer={
          <>
            {t('auth.register.hasAccount')}{' '}
            <Link
              to="/connexion"
              state={location.state}
              className="inline-flex min-h-11 items-center font-semibold text-terracotta-700 underline underline-offset-4"
            >
              {t('auth.register.signIn')}
            </Link>
          </>
        }
      >
        {general && <FormAlert>{general}</FormAlert>}
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-5">
          <Input
            name="nom"
            label={t('auth.register.name')}
            value={values.nom}
            onChange={onChange}
            error={errors.nom}
            autoComplete="name"
            required
          />
          <Input
            name="email"
            type="email"
            label={t('auth.register.email')}
            value={values.email}
            onChange={onChange}
            error={errors.email}
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            ltr
            required
          />
          <Input
            name="telephone"
            type="tel"
            label={t('auth.register.phone')}
            hint={t('auth.register.phoneHint')}
            value={values.telephone}
            onChange={onChange}
            error={errors.telephone}
            autoComplete="tel"
            inputMode="tel"
            ltr
            optional
          />
          <PasswordInput
            name="password"
            label={t('auth.register.password')}
            hint={t('auth.register.passwordHint', { min: PASSWORD_MIN })}
            value={values.password}
            onChange={onChange}
            error={errors.password}
            autoComplete="new-password"
            required
          />
          <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-2">
            {t('auth.register.submit')}
          </Button>
        </form>
      </AuthLayout>
    </>
  )
}
