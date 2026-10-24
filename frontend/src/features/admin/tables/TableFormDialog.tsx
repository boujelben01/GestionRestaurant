import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertIcon, Button, Dialog, Input, useToast } from '@/components/ui'
import { toAppError } from '@/lib/errors'
import type { AdminTable } from '@/lib/types'
import { adminErrorMessage } from '../adminErrors'
import { useCreateTable, useUpdateTable } from './api'
import {
  CAPACITE_MAX,
  CAPACITE_MIN,
  NUMERO_MAX,
  NUMERO_MIN,
  validateTable,
  type TableFormValues,
} from './validation'

type Field = 'numero' | 'capacite'

interface TableFormDialogProps {
  /** null = création. */
  table: AdminTable | null
  onClose: () => void
}

/** Ajout (numéro facultatif, capacité 4 par défaut) ou modification d'une table. */
export function TableFormDialog({ table, onClose }: TableFormDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const create = useCreateTable()
  const update = useUpdateTable()
  const pending = create.isPending || update.isPending
  const [values, setValues] = useState<TableFormValues>({
    numero: table ? String(table.numero) : '',
    capacite: table ? String(table.capacite) : '4',
  })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [general, setGeneral] = useState<string>()

  const set = (key: Field) => (event: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: event.target.value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    setGeneral(undefined)
    const codes = validateTable(values, { numeroRequired: table !== null })
    const mapped: Partial<Record<Field, string>> = {}
    for (const [key, code] of Object.entries(codes)) {
      mapped[key as Field] = t(`admin.tables.errors.${code}`, {
        min: key === 'numero' ? NUMERO_MIN : CAPACITE_MIN,
        max: key === 'numero' ? NUMERO_MAX : CAPACITE_MAX,
      })
    }
    setErrors(mapped)
    const first = (Object.keys(mapped) as Field[])[0]
    if (first) {
      ;(form.elements.namedItem(first) as HTMLElement | null)?.focus()
      return
    }
    try {
      if (table) await update.mutateAsync({ id: table.id, values })
      else await create.mutateAsync(values)
      toast(table ? t('admin.tables.updated') : t('admin.tables.created'), { variant: 'success' })
      onClose()
    } catch (error) {
      const e = toAppError(error)
      const fields: Partial<Record<Field, string>> = {}
      for (const key of ['numero', 'capacite'] as const) {
        const message = e.fieldError(key)
        if (message) fields[key] = message
      }
      if (e.status === 409) fields.numero = t('admin.tables.errors.numeroTaken')
      setErrors(fields)
      if (Object.keys(fields).length === 0) setGeneral(adminErrorMessage(error, t))
      else
        (
          form.elements.namedItem(fields.numero ? 'numero' : 'capacite') as HTMLElement | null
        )?.focus()
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        table
          ? t('admin.tables.editTitle', { number: table.numero })
          : t('admin.tables.createTitle')
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="table-form" loading={pending}>
            {t('admin.common.save')}
          </Button>
        </>
      }
    >
      <form
        id="table-form"
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
          name="numero"
          label={t('admin.tables.number')}
          hint={table ? undefined : t('admin.tables.numberHint')}
          placeholder={table ? undefined : t('admin.tables.numberPlaceholder')}
          value={values.numero}
          onChange={set('numero')}
          error={errors.numero}
          inputMode="numeric"
          ltr
          required={table !== null}
          optional={table === null}
          data-autofocus
        />
        <Input
          name="capacite"
          label={t('admin.tables.capacity')}
          value={values.capacite}
          onChange={set('capacite')}
          error={errors.capacite}
          inputMode="numeric"
          ltr
          required
        />
      </form>
    </Dialog>
  )
}
