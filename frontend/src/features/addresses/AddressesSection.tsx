import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  Dialog,
  EditIcon,
  EmptyState,
  ErrorState,
  PinIcon,
  Skeleton,
  TrashIcon,
  useToast,
} from '@/components/ui'
import { toAppError } from '@/lib/errors'
import type { Address } from '@/lib/types'
import { useAddresses, useDeleteAddress, useSetDefaultAddress } from './api'
import { AddressFormDialog } from './AddressFormDialog'
import { MAX_ADDRESSES, canAddAddress } from './rules'

/** « Mes adresses » (clients) : carnet de 10 adresses au plus, adresse par défaut, ajout, édition, suppression. */
export function AddressesSection() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { data, isPending, isError, error, refetch, isFetching } = useAddresses()
  const remove = useDeleteAddress()
  const setDefault = useSetDefaultAddress()
  const [form, setForm] = useState<Address | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Address | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const list = data ?? []
  const canAdd = canAddAddress(list.length)

  const confirmDelete = async () => {
    if (!toDelete) return
    const target = toDelete
    setBusyId(target.id)
    try {
      await remove.mutateAsync({ id: target.id })
      setToDelete(null)
      toast(t('addresses.deleted'), { variant: 'success' })
    } catch (e) {
      setToDelete(null)
      toast(toAppError(e).isNetwork ? t('errors.network') : t('errors.generic'), {
        variant: 'error',
      })
    } finally {
      setBusyId(null)
    }
  }

  const makeDefault = (address: Address) => {
    setBusyId(address.id)
    setDefault.mutate(
      { id: address.id },
      {
        onSuccess: () => toast(t('addresses.defaultSet'), { variant: 'success' }),
        onError: () => toast(t('errors.generic'), { variant: 'error' }),
        onSettled: () => setBusyId(null),
      },
    )
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl">{t('addresses.title')}</h2>
          {data && (
            <p role="status" className="tabular mt-1 text-sm text-ink-700">
              {t('addresses.count', { count: list.length, max: MAX_ADDRESSES })}
            </p>
          )}
        </div>
        <Button
          size="sm"
          aria-disabled={!canAdd || undefined}
          aria-describedby={!canAdd ? 'address-limit' : undefined}
          onClick={() => canAdd && setForm('new')}
        >
          {t('addresses.add')}
        </Button>
      </div>
      {data && !canAdd && (
        <p id="address-limit" className="mt-2 text-sm font-medium text-danger-800">
          {t('addresses.limitReached', { max: MAX_ADDRESSES })}
        </p>
      )}

      <div className="mt-4">
        {isPending && (
          <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        )}
        {isError && (
          <ErrorState compact error={error} onRetry={() => void refetch()} retrying={isFetching} />
        )}
        {data && list.length === 0 && (
          <EmptyState
            compact
            icon={<PinIcon />}
            title={t('addresses.emptyTitle')}
            description={t('addresses.emptyText')}
            action={<Button onClick={() => setForm('new')}>{t('addresses.add')}</Button>}
          />
        )}
        <ul className="flex flex-col gap-3">
          {list.map((address) => (
            <li
              key={address.id}
              className="flex flex-col gap-3 rounded-lg border border-sand-300 bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg font-semibold">{address.libelle}</p>
                {address.estParDefaut && <Badge tone="olive">{t('addresses.default')}</Badge>}
              </div>
              <div className="text-sm text-ink-700">
                <p>
                  {address.ligne}, {address.ville}
                </p>
                {address.details && <p>{address.details}</p>}
                <p dir="ltr" className="tabular text-start">
                  {address.telephone}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!address.estParDefaut && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === address.id}
                    onClick={() => makeDefault(address)}
                  >
                    {t('addresses.setDefault')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  icon={<EditIcon className="size-4" />}
                  disabled={busyId === address.id}
                  onClick={() => setForm(address)}
                  aria-label={`${t('addresses.edit')} : ${address.libelle}`}
                >
                  {t('addresses.edit')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger-800"
                  icon={<TrashIcon className="size-4" />}
                  disabled={busyId === address.id}
                  onClick={() => setToDelete(address)}
                  aria-label={`${t('addresses.delete')} : ${address.libelle}`}
                >
                  {t('addresses.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {form !== null && (
        <AddressFormDialog
          key={form === 'new' ? 'new' : form.id}
          address={form === 'new' ? null : form}
          firstAddress={list.length === 0}
          onClose={() => setForm(null)}
        />
      )}

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={t('addresses.deleteTitle')}
        description={
          toDelete?.estParDefaut ? t('addresses.deleteDefaultNote') : t('addresses.deleteText')
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => void confirmDelete()}
            >
              {t('addresses.deleteConfirm')}
            </Button>
          </>
        }
      >
        {toDelete && (
          <p className="text-sm font-semibold">
            {toDelete.libelle} · {toDelete.ligne}, {toDelete.ville}
          </p>
        )}
      </Dialog>
    </Card>
  )
}
