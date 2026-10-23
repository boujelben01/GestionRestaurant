import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { Button, Input, useToast } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { AuthLayout, FormAlert, PasswordInput } from '@/features/auth/AuthLayout'
import { describeFormError, safeRedirect } from '@/features/auth/authErrors'
import { validateLogin, type FieldErrors } from '@/features/auth/validation'

type Field = 'identifiant' | 'password'
const FIELDS = ['identifiant', 'password'] as const

export default function Login() {
  const { t } = useTranslation()
  const { login, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const location = useLocation()
  const from = safeRedirect((location.state as { from?: unknown } | null)?.from)

  const [values, setValues] = useState({ identifiant: '', password: '' })
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
    const clientErrors = validateLogin(values, t)
    setErrors(clientErrors)
    setGeneral(undefined)
    if (Object.keys(clientErrors).length > 0) {
      focusFirst(form, clientErrors)
      return
    }

    setSubmitting(true)
    try {
      const user = await login({
        identifiant: values.identifiant.trim(),
        password: values.password,
      })
      toast(t('auth.welcome', { name: user.nom?.trim() || user.userName }), { variant: 'success' })
    } catch (error) {
      const failure = describeFormError(error, t, FIELDS, 'login')
      setErrors(failure.fields)
      setGeneral(failure.general)
      focusFirst(form, failure.fields)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Seo title={t('seo.loginTitle')} description={t('seo.loginDescription')} noindex />
      <AuthLayout
        title={t('auth.login.title')}
        subtitle={t('auth.login.subtitle')}
        footer={
          <>
            {t('auth.login.noAccount')}{' '}
            <Link
              to="/inscription"
              state={location.state}
              className="inline-flex min-h-11 items-center font-semibold text-terracotta-700 underline underline-offset-4"
            >
              {t('auth.login.createAccount')}
            </Link>
          </>
        }
      >
        {general && <FormAlert>{general}</FormAlert>}
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-5">
          <Input
            name="identifiant"
            label={t('auth.login.identifiant')}
            placeholder={t('auth.login.identifiantPlaceholder')}
            value={values.identifiant}
            onChange={onChange}
            error={errors.identifiant}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            ltr
            required
          />
          <PasswordInput
            name="password"
            label={t('auth.login.password')}
            value={values.password}
            onChange={onChange}
            error={errors.password}
            autoComplete="current-password"
            required
          />
          <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-2">
            {t('auth.login.submit')}
          </Button>
        </form>
      </AuthLayout>
    </>
  )
}
