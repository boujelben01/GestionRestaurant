import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, Card, Input, useToast } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { FormAlert, PasswordInput } from '@/features/auth/AuthLayout'
import type { FieldErrors } from '@/features/auth/validation'
import { useChangePassword, useUpdateProfile } from '@/features/profile/api'
import {
  PASSWORD_MIN,
  validatePasswordChange,
  validateProfile,
} from '@/features/profile/validation'
import { cn } from '@/lib/cn'
import { toAppError } from '@/lib/errors'
import { setExplicitLang } from '@/lib/i18n'
import type { Lang } from '@/lib/types'

function failureMessage(error: unknown, t: ReturnType<typeof useTranslation>['t']) {
  const e = toAppError(error)
  if (e.isNetwork) return t('errors.network')
  if (e.status !== null && e.status >= 500) return t('errors.server')
  return t('errors.generic')
}

function ProfileForm() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()
  const update = useUpdateProfile()

  const [nom, setNom] = useState(user?.nom ?? '')
  const [telephone, setTelephone] = useState(user?.telephone ?? '')
  const [langue, setLangue] = useState<Lang>(user?.langueFavorite ?? 'fr')
  const [errors, setErrors] = useState<FieldErrors<'nom' | 'telephone' | 'langueFavorite'>>({})
  const [general, setGeneral] = useState<string>()

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    setGeneral(undefined)
    const clientErrors = validateProfile({ nom, telephone }, t)
    setErrors(clientErrors)
    const first = (['nom', 'telephone'] as const).find((k) => clientErrors[k])
    if (first) {
      ;(form.elements.namedItem(first) as HTMLElement | null)?.focus()
      return
    }
    const previous = user?.langueFavorite
    try {
      await update.mutateAsync({ nom, telephone, langueFavorite: langue })
      if (langue !== previous) await setExplicitLang(langue)
      toast(t('profile.saved'), { variant: 'success' })
    } catch (error) {
      const e = toAppError(error)
      const fields: typeof errors = {}
      for (const key of ['nom', 'telephone', 'langueFavorite'] as const) {
        const message = e.fieldError(key)
        if (message) fields[key] = message
      }
      setErrors(fields)
      setGeneral(Object.keys(fields).length > 0 ? t('auth.errors.form') : failureMessage(error, t))
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xl sm:text-2xl">{t('profile.info')}</h2>
      {general && (
        <div className="mt-4">
          <FormAlert>{general}</FormAlert>
        </div>
      )}
      <form
        onSubmit={(event) => void onSubmit(event)}
        noValidate
        className="mt-5 flex flex-col gap-5"
      >
        <Input
          name="nom"
          label={t('profile.name')}
          value={nom}
          onChange={(event) => setNom(event.target.value)}
          error={errors.nom}
          autoComplete="name"
          optional
        />
        <Input
          name="email"
          label={t('profile.email')}
          hint={t('profile.emailHint')}
          value={user?.email ?? ''}
          readOnly
          ltr
          className="bg-sand-100 text-ink-700"
        />
        <Input
          name="telephone"
          type="tel"
          label={t('profile.phone')}
          value={telephone}
          onChange={(event) => setTelephone(event.target.value)}
          error={errors.telephone}
          autoComplete="tel"
          inputMode="tel"
          ltr
          optional
        />
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-ink-800">
            {t('profile.language')}
          </legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-3">
            {(['fr', 'ar'] as const).map((code) => (
              <div key={code} className="relative">
                <input
                  type="radio"
                  name="langueFavorite"
                  id={`lang-${code}`}
                  value={code}
                  checked={langue === code}
                  onChange={() => setLangue(code)}
                  className="peer sr-only"
                />
                <label
                  htmlFor={`lang-${code}`}
                  lang={code}
                  dir={code === 'ar' ? 'rtl' : 'ltr'}
                  className={cn(
                    'flex min-h-12 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-sand-400 bg-white px-4 font-semibold transition-colors duration-200',
                    'peer-checked:border-terracotta-600 peer-checked:bg-terracotta-100/50 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sidi-600 hover:border-ink-500',
                  )}
                >
                  {t(`lang.${code}`, { lng: code })}
                </label>
              </div>
            ))}
          </div>
          {errors.langueFavorite && (
            <p className="mt-1.5 text-sm font-medium text-danger-600">{errors.langueFavorite}</p>
          )}
        </fieldset>
        <Button type="submit" size="lg" loading={update.isPending} className="self-start">
          {t('profile.save')}
        </Button>
      </form>
    </Card>
  )
}

function PasswordForm() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const change = useChangePassword()
  const empty = { currentPassword: '', newPassword: '', confirm: '' }
  const [values, setValues] = useState(empty)
  const [errors, setErrors] = useState<FieldErrors<'currentPassword' | 'newPassword' | 'confirm'>>(
    {},
  )
  const [general, setGeneral] = useState<string>()

  const set = (key: keyof typeof empty) => (event: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: event.target.value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    setGeneral(undefined)
    const clientErrors = validatePasswordChange(values, t)
    setErrors(clientErrors)
    const first = (['currentPassword', 'newPassword', 'confirm'] as const).find(
      (k) => clientErrors[k],
    )
    if (first) {
      ;(form.elements.namedItem(first) as HTMLElement | null)?.focus()
      return
    }
    try {
      await change.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      setValues(empty)
      toast(t('profile.password.saved'), { variant: 'success' })
    } catch (error) {
      const e = toAppError(error)
      const fields: typeof errors = {}
      if (e.fieldError('currentPassword'))
        fields.currentPassword = t('profile.password.wrongCurrent')
      const newPwd = e.fieldError('newPassword')
      if (newPwd) fields.newPassword = newPwd
      setErrors(fields)
      setGeneral(Object.keys(fields).length > 0 ? t('auth.errors.form') : failureMessage(error, t))
      const firstServer = (['currentPassword', 'newPassword'] as const).find((k) => fields[k])
      if (firstServer) (form.elements.namedItem(firstServer) as HTMLElement | null)?.focus()
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xl sm:text-2xl">{t('profile.password.title')}</h2>
      {general && (
        <div className="mt-4">
          <FormAlert>{general}</FormAlert>
        </div>
      )}
      <form
        onSubmit={(event) => void onSubmit(event)}
        noValidate
        className="mt-5 flex flex-col gap-5"
      >
        <PasswordInput
          name="currentPassword"
          label={t('profile.password.current')}
          value={values.currentPassword}
          onChange={set('currentPassword')}
          error={errors.currentPassword}
          autoComplete="current-password"
          required
        />
        <PasswordInput
          name="newPassword"
          label={t('profile.password.new')}
          hint={t('auth.register.passwordHint', { min: PASSWORD_MIN })}
          value={values.newPassword}
          onChange={set('newPassword')}
          error={errors.newPassword}
          autoComplete="new-password"
          required
        />
        <PasswordInput
          name="confirm"
          label={t('profile.password.confirm')}
          value={values.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
          autoComplete="new-password"
          required
        />
        <Button
          type="submit"
          size="lg"
          variant="secondary"
          loading={change.isPending}
          className="self-start"
        >
          {t('profile.password.submit')}
        </Button>
      </form>
    </Card>
  )
}

export default function Profile() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  return (
    <>
      <Seo title={t('profile.title')} noindex />
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />
      <div className="container-page flex-1 py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <ProfileForm />
          <PasswordForm />
          <div className="flex justify-center py-2">
            <Button
              variant="outline"
              onClick={() => {
                logout()
                toast(t('auth.loggedOut'), { variant: 'success' })
                void navigate('/')
              }}
            >
              {t('nav.logout')}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
