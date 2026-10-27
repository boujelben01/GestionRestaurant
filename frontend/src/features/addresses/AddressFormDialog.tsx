import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertIcon, Button, Dialog, Input, useToast } from '@/components/ui'
import { toAppError } from '@/lib/errors'
import type { Address } from '@/lib/types'
import { useCreateAddress, useUpdateAddress } from './api'
import {
  EMPTY_ADDRESS,
  LIMITS,
  MAX_ADDRESSES,
  toFormValues,
  validateAddress,
  type AddressField,
  type AddressFormValues,
} from './rules'

const FIELDS: AddressField[] = ['libelle', 'ligne', 'ville', 'details', 'telephone']

interface AddressFormDialogProps {
  /** null = création. */
  address: Address | null
  /** Première adresse du carnet : cochée par défaut. */
  firstAddress: boolean
  onClose: () => void
}

/** Ajout ou modification d'une adresse : erreurs traduites par champ, 409 = limite de 10 adresses. */
export function AddressFormDialog({ address, firstAddress, onClose }: AddressFormDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const create = useCreateAddress()
  const update = useUpdateAddress()
  const pending = create.isPending || update.isPending
  const [values, setValues] = useState<AddressFormValues>(
    address ? toFormValues(address) : { ...EMPTY_ADDRESS, estParDefaut: firstAddress },
  )
  const [errors, setErrors] = useState<Partial<Record<AddressField, string>>>({})
  const [general, setGeneral] = useState<string>()

  const set = (key: AddressField) => (event: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: event.target.value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    setGeneral(undefined)
    const codes = validateAddress(values)
    const mapped: Partial<Record<AddressField, string>> = {}
    for (const [key, code] of Object.entries(codes)) {
      mapped[key as AddressField] = t(`addresses.errors.${code}`, {
        max: LIMITS[key as AddressField],
      })
    }
    setErrors(mapped)
    const first = FIELDS.find((f) => mapped[f])
    if (first) {
      ;(form.elements.namedItem(first) as HTMLElement | null)?.focus()
      return
    }
    try {
      if (address) await update.mutateAsync({ id: address.id, values })
      else await create.mutateAsync(values)
      toast(t('addresses.saved'), { variant: 'success' })
      onClose()
    } catch (error) {
      const e = toAppError(error)
      const fields: Partial<Record<AddressField, string>> = {}
      for (const key of FIELDS) {
        const message = e.fieldError(key)
        if (message) fields[key] = message
      }
      setErrors(fields)
      if (e.status === 409) setGeneral(t('addresses.errors.limit', { max: MAX_ADDRESSES }))
      else if (Object.keys(fields).length > 0) setGeneral(t('auth.errors.form'))
      else if (e.isNetwork) setGeneral(t('errors.network'))
      else setGeneral(t('errors.generic'))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={address ? t('addresses.editTitle') : t('addresses.createTitle')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="address-form" loading={pending}>
            {t('addresses.save')}
          </Button>
        </>
      }
    >
      <form
        id="address-form"
        onSubmit={(event) => void onSubmit(event)}
        noValidate
        className="flex flex-col gap-4"
      >
        {general && (
          <p role="alert" className="flex items-start gap-2 text-sm font-medium text-danger-800">
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            {general}
          </p>
        )}
        <Input
          name="libelle"
          label={t('addresses.label')}
          hint={t('addresses.labelHint')}
          value={values.libelle}
          onChange={set('libelle')}
          error={errors.libelle}
          required
          data-autofocus
        />
        <Input
          name="ligne"
          label={t('addresses.line')}
          value={values.ligne}
          onChange={set('ligne')}
          error={errors.ligne}
          autoComplete="street-address"
          required
        />
        <Input
          name="ville"
          label={t('addresses.city')}
          value={values.ville}
          onChange={set('ville')}
          error={errors.ville}
          autoComplete="address-level2"
          required
        />
        <Input
          name="details"
          label={t('addresses.details')}
          hint={t('addresses.detailsHint')}
          value={values.details}
          onChange={set('details')}
          error={errors.details}
          optional
        />
        <Input
          name="telephone"
          type="tel"
          label={t('addresses.phone')}
          value={values.telephone}
          onChange={set('telephone')}
          error={errors.telephone}
          autoComplete="tel"
          inputMode="tel"
          ltr
          required
        />
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={values.estParDefaut}
            onChange={(event) => setValues((v) => ({ ...v, estParDefaut: event.target.checked }))}
            className="size-5 accent-terracotta-600"
          />
          {t('addresses.makeDefault')}
        </label>
      </form>
    </Dialog>
  )
}
