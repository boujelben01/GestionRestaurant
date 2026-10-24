import { useCallback, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import {
  AlertIcon,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Skeleton,
  TableIcon,
  useToast,
} from '@/components/ui'
import { adminErrorMessage } from '@/features/admin/adminErrors'
import {
  useAdminTables,
  useRegenerateTableCode,
  useSetTableActive,
} from '@/features/admin/tables/api'
import { PrintSheet } from '@/features/admin/tables/PrintSheet'
import {
  isLocalAddress,
  printableTables,
  publicBaseUrl,
  tableQrUrl,
} from '@/features/admin/tables/qr'
import { TableCard } from '@/features/admin/tables/TableCard'
import { TableFormDialog } from '@/features/admin/tables/TableFormDialog'
import { useQrImages } from '@/features/admin/tables/useQrImages'
import { useRestaurant } from '@/features/restaurant/api'
import type { AdminTable } from '@/lib/types'

type Confirm = { kind: 'deactivate' | 'regenerate'; table: AdminTable }

/** Copie dans le presse-papiers, avec repli (contexte non sécurisé / ancien navigateur). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

/** Onglet « Gestion » : adresse des QR, cartes de tables, impression, ajout et modification. */
export function GestionView() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { data: tables, isPending, isError, error, refetch, isFetching } = useAdminTables()
  const { data: restaurant } = useRestaurant()
  const setActive = useSetTableActive()
  const regenerate = useRegenerateTableCode()

  const base = publicBaseUrl()
  const local = isLocalAddress(base)
  const urlOf = useCallback((table: AdminTable) => tableQrUrl(base, table.code), [base])

  const [form, setForm] = useState<AdminTable | 'new' | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  // null = toutes les tables actives ; un identifiant = cette seule table.
  const [printTarget, setPrintTarget] = useState<number | null>(null)

  const all = useMemo(() => tables ?? [], [tables])
  const sorted = useMemo(() => [...all].sort((a, b) => a.numero - b.numero || a.id - b.id), [all])
  const printable = useMemo(() => printableTables(all), [all])
  const images = useQrImages(sorted.map(urlOf))
  const allReady = printable.every((table) => images[urlOf(table)])

  const sheetTables = useMemo(
    () =>
      printTarget === null ? printable : printable.filter((table) => table.id === printTarget),
    [printTarget, printable],
  )

  // La feuille revient à « toutes les tables » une fois l'impression terminée ou annulée.
  useEffect(() => {
    const reset = () => setPrintTarget(null)
    window.addEventListener('afterprint', reset)
    return () => window.removeEventListener('afterprint', reset)
  }, [])

  const print = async (target: number | null) => {
    if (!allReady) return
    flushSync(() => setPrintTarget(target))
    // On attend que les images de la feuille soient décodées avant d'ouvrir la boîte d'impression.
    const sheet = document.querySelector<HTMLElement>('[data-print-sheet]')
    const pictures = sheet ? [...sheet.querySelectorAll('img')] : []
    await Promise.all(pictures.map((img) => img.decode().catch(() => undefined)))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    window.print()
  }

  const copy = async (url: string) => {
    const ok = await copyText(url)
    toast(ok ? t('admin.tables.linkCopied') : t('admin.tables.copyFailed'), {
      variant: ok ? 'success' : 'error',
    })
  }

  const toggle = (table: AdminTable) => {
    if (table.estActive) {
      setConfirm({ kind: 'deactivate', table })
      return
    }
    setBusyId(table.id)
    setActive.mutate(
      { id: table.id, estActive: true },
      {
        onSuccess: () => toast(t('admin.tables.activated'), { variant: 'success' }),
        onError: (e) => toast(adminErrorMessage(e, t), { variant: 'error' }),
        onSettled: () => setBusyId(null),
      },
    )
  }

  const runConfirmed = () => {
    if (!confirm) return
    const { kind, table } = confirm
    setConfirm(null)
    setBusyId(table.id)
    const handlers = {
      onError: (e: unknown) => toast(adminErrorMessage(e, t), { variant: 'error' }),
      onSettled: () => setBusyId(null),
    }
    if (kind === 'deactivate') {
      setActive.mutate(
        { id: table.id, estActive: false },
        {
          ...handlers,
          onSuccess: () => toast(t('admin.tables.deactivated'), { variant: 'success' }),
        },
      )
    } else {
      regenerate.mutate(
        { id: table.id },
        {
          ...handlers,
          onSuccess: () => toast(t('admin.tables.regenerated'), { variant: 'success' }),
        },
      )
    }
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <section
          aria-labelledby="qr-address"
          className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-soft sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="qr-address" className="text-lg">
                {t('admin.tables.addressTitle')}
              </h2>
              <p dir="ltr" className="mt-1 font-semibold break-all select-all">
                {base}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                aria-disabled={printable.length === 0 || !allReady || undefined}
                aria-describedby={printable.length === 0 ? 'print-all-off' : undefined}
                onClick={() => printable.length > 0 && void print(null)}
              >
                {t('admin.tables.printAll')}
              </Button>
              <Button onClick={() => setForm('new')}>{t('admin.tables.add')}</Button>
            </div>
          </div>
          {printable.length === 0 && tables && (
            <p id="print-all-off" className="text-sm text-ink-500">
              {t('admin.tables.printAllDisabled')}
            </p>
          )}
          {printable.length > 0 && !allReady && (
            <p role="status" className="text-sm text-ink-500">
              {t('admin.tables.qrPreparing')}
            </p>
          )}
          {local && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-md border-2 border-terracotta-600 bg-terracotta-100 p-4 text-terracotta-700"
            >
              <AlertIcon className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-bold">{t('admin.tables.addressWarning')}</p>
                <p className="mt-1 text-sm">{t('admin.tables.addressWarningHelp')}</p>
              </div>
            </div>
          )}
        </section>

        {isPending && (
          <div
            role="status"
            aria-label={t('common.loading')}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-96 rounded-lg" />
            ))}
          </div>
        )}
        {isError && (
          <ErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} />
        )}
        {tables && tables.length === 0 && (
          <EmptyState
            icon={<TableIcon />}
            title={t('admin.tables.empty')}
            description={t('admin.tables.emptyText')}
            action={<Button onClick={() => setForm('new')}>{t('admin.tables.add')}</Button>}
          />
        )}

        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {sorted.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                url={urlOf(table)}
                image={images[urlOf(table)]}
                busy={busyId === table.id}
                printDisabled={!allReady}
                onPrint={(tbl) => void print(tbl.id)}
                onCopy={(url) => void copy(url)}
                onEdit={setForm}
                onToggle={toggle}
                onRegenerate={(tbl) => setConfirm({ kind: 'regenerate', table: tbl })}
              />
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <PrintSheet
        restaurantName={restaurant?.nom ?? t('brand.name')}
        tables={sheetTables}
        urlOf={urlOf}
        images={images}
      />

      {form !== null && (
        <TableFormDialog
          key={form === 'new' ? 'new' : form.id}
          table={form === 'new' ? null : form}
          onClose={() => setForm(null)}
        />
      )}

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm?.kind === 'regenerate'
            ? t('admin.tables.regenerateTitle', { number: confirm.table.numero })
            : t('admin.tables.deactivateTitle', { number: confirm?.table.numero ?? '' })
        }
        description={
          confirm?.kind === 'regenerate'
            ? t('admin.tables.regenerateText')
            : t('admin.tables.deactivateText')
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={runConfirmed}>
              {confirm?.kind === 'regenerate'
                ? t('admin.tables.regenerateConfirm')
                : t('admin.tables.deactivate')}
            </Button>
          </>
        }
      />
    </>
  )
}
