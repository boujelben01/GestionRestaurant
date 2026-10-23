import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Skeleton,
  UsersIcon,
  useToast,
} from '@/components/ui'
import { adminErrorMessage } from '@/features/admin/adminErrors'
import { useAdminUsers, useSetUserActive } from '@/features/admin/users/api'
import { canToggleUser } from '@/features/admin/users/rules'
import { useAuth } from '@/features/auth/AuthContext'
import { formatDateTime } from '@/lib/format'
import type { AdminUser } from '@/lib/types'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { useLang } from '@/lib/useLang'

const PAGE_SIZE = 20

export default function AdminUsers() {
  const { t } = useTranslation()
  const lang = useLang()
  const { toast } = useToast()
  const { user: me } = useAuth()
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [confirmOff, setConfirmOff] = useState<AdminUser | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const search = useDebouncedValue(searchText, 300)
  const { data, isPending, isError, refetch, isFetching } = useAdminUsers(search, page, PAGE_SIZE)
  const setActive = useSetUserActive()

  const apply = (target: AdminUser, estActif: boolean) => {
    setBusyId(target.id)
    setActive.mutate(
      { id: target.id, estActif },
      {
        onSuccess: () =>
          toast(estActif ? t('admin.users.reactivated') : t('admin.users.deactivated'), {
            variant: 'success',
          }),
        onError: (error) => toast(adminErrorMessage(error, t), { variant: 'error' }),
        onSettled: () => setBusyId(null),
      },
    )
  }

  const display = (u: AdminUser) => u.nom?.trim() || u.userName

  const actionFor = (u: AdminUser) => {
    const allowed = canToggleUser(u, me?.id)
    const busy = busyId === u.id
    return (
      <div className="flex flex-col items-start gap-1">
        <Button
          variant={u.estActif ? 'outline' : 'primary'}
          size="sm"
          loading={busy}
          aria-disabled={allowed ? undefined : true}
          aria-describedby={allowed ? undefined : `self-${u.id}`}
          aria-label={`${u.estActif ? t('admin.users.deactivate') : t('admin.users.reactivate')} ${display(u)}`}
          onClick={() => {
            if (!allowed) return
            if (u.estActif) setConfirmOff(u)
            else apply(u, true)
          }}
        >
          {u.estActif ? t('admin.users.deactivate') : t('admin.users.reactivate')}
        </Button>
        {!allowed && (
          <p id={`self-${u.id}`} className="max-w-56 text-xs text-ink-500">
            {t('admin.users.selfExplain')}
          </p>
        )}
      </div>
    )
  }

  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <>
      <Seo title={t('admin.nav.users')} noindex />
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Input
            type="search"
            label={t('admin.common.search')}
            placeholder={t('admin.users.searchPlaceholder')}
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value)
              setPage(1)
            }}
            autoComplete="off"
            wrapperClassName="w-full max-w-md"
          />
          <p role="status" aria-live="polite" className="text-sm text-ink-700">
            {data && t('admin.common.results', { count: data.total })}
          </p>
        </div>

        {isPending && (
          <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        )}
        {isError && <ErrorState onRetry={() => void refetch()} retrying={isFetching} />}
        {data && data.items.length === 0 && (
          <EmptyState icon={<UsersIcon />} title={t('admin.users.empty')} />
        )}

        {data && data.items.length > 0 && (
          <>
            <ul className="flex flex-col gap-3 md:hidden">
              {data.items.map((u) => (
                <li key={u.id} className="flex flex-col gap-2 rounded-lg bg-white p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{display(u)}</p>
                    <Badge tone={u.estActif ? 'olive' : 'neutral'}>
                      {u.estActif ? t('admin.common.active') : t('admin.users.deactivatedBadge')}
                    </Badge>
                  </div>
                  <bdi dir="ltr" className="text-sm text-ink-700">
                    {u.email}
                  </bdi>
                  <p className="tabular text-xs text-ink-500">
                    @{u.userName} · {formatDateTime(u.dateCreation, lang)}
                  </p>
                  {actionFor(u)}
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto rounded-lg bg-white shadow-soft md:block">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('admin.nav.users')}</caption>
                <thead className="bg-sand-100 text-xs tracking-wide uppercase">
                  <tr>
                    {['name', 'email', 'username', 'created', 'status', 'actions'].map((col) => (
                      <th key={col} scope="col" className="px-4 py-3 text-start font-semibold">
                        {t(`admin.users.col.${col}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200">
                  {data.items.map((u) => (
                    <tr key={u.id} className="align-top">
                      <td className="px-4 py-3 font-semibold">{display(u)}</td>
                      <td className="px-4 py-3">
                        <bdi dir="ltr">{u.email}</bdi>
                      </td>
                      <td className="px-4 py-3">
                        <bdi dir="ltr">{u.userName}</bdi>
                      </td>
                      <td className="tabular px-4 py-3 whitespace-nowrap">
                        {formatDateTime(u.dateCreation, lang)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={u.estActif ? 'olive' : 'neutral'}>
                          {u.estActif
                            ? t('admin.common.active')
                            : t('admin.users.deactivatedBadge')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{actionFor(u)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageCount={pageCount} onPage={setPage} busy={isFetching} />
          </>
        )}
      </div>

      <Dialog
        open={confirmOff !== null}
        onClose={() => setConfirmOff(null)}
        title={t('admin.users.confirmTitle')}
        description={t('admin.users.confirmText', { name: confirmOff ? display(confirmOff) : '' })}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOff(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmOff) apply(confirmOff, false)
                setConfirmOff(null)
              }}
            >
              {t('admin.users.deactivate')}
            </Button>
          </>
        }
      />
    </>
  )
}
