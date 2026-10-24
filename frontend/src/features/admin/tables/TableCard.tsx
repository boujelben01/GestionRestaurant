import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, EditIcon, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { AdminTable } from '@/lib/types'

interface TableCardProps {
  table: AdminTable
  url: string
  /** Image du QR (data URI) ; absente tant qu'elle est en cours de génération. */
  image: string | undefined
  busy: boolean
  /** Impression impossible tant que les QR ne sont pas prêts. */
  printDisabled: boolean
  onPrint: (table: AdminTable) => void
  onCopy: (url: string) => void
  onEdit: (table: AdminTable) => void
  onToggle: (table: AdminTable) => void
  onRegenerate: (table: AdminTable) => void
}

/** Carte d'une table : QR (toujours noir sur blanc), lien complet et actions. */
export function TableCard({
  table,
  url,
  image,
  busy,
  printDisabled,
  onPrint,
  onCopy,
  onEdit,
  onToggle,
  onRegenerate,
}: TableCardProps) {
  const { t } = useTranslation()
  const inactive = !table.estActive
  const printBlocked = inactive || printDisabled

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow-soft sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">
            {t('admin.tables.table', { number: table.numero })}
          </h2>
          <p className="tabular text-sm text-ink-700">
            {t('admin.tables.seats', { count: table.capacite })}
          </p>
        </div>
        <Badge tone={table.estActive ? 'olive' : 'neutral'} dot>
          {table.estActive ? t('admin.common.active') : t('admin.common.inactive')}
        </Badge>
      </div>

      {/* Fond blanc et marge : le QR reste contrasté même sur une carte colorée. */}
      <div className="relative mx-auto grid w-full max-w-[16rem] place-items-center rounded-md border border-sand-300 bg-white p-2">
        {image ? (
          <img
            src={image}
            alt={t('admin.tables.qrAlt', { number: table.numero })}
            width={240}
            height={240}
            className={cn(
              'aspect-square w-full min-w-[200px] bg-white transition-opacity duration-300',
              inactive && 'opacity-30 grayscale',
            )}
          />
        ) : (
          <Skeleton className="aspect-square w-full min-w-[200px]" />
        )}
        {inactive && image && (
          <span className="absolute rounded-full bg-ink-900 px-3 py-1.5 text-sm font-bold text-sand-50 shadow-soft">
            {t('admin.tables.qrOff')}
          </span>
        )}
      </div>

      <p
        dir="ltr"
        className="rounded-md bg-sand-100 px-3 py-2 text-xs break-all text-ink-700 select-all"
      >
        {url}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-disabled={printBlocked || undefined}
          aria-describedby={inactive ? `print-off-${table.id}` : undefined}
          onClick={() => !printBlocked && onPrint(table)}
        >
          {t('admin.tables.print')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => onCopy(url)}>
          {t('admin.tables.copy')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={<EditIcon className="size-4" />}
          disabled={busy}
          onClick={() => onEdit(table)}
        >
          {t('admin.common.edit')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          loading={busy}
          onClick={() => onToggle(table)}
        >
          {table.estActive ? t('admin.tables.deactivate') : t('admin.tables.activate')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="col-span-2 text-danger-800"
          disabled={busy}
          onClick={() => onRegenerate(table)}
        >
          {t('admin.tables.regenerate')}
        </Button>
      </div>
      {inactive && (
        <p id={`print-off-${table.id}`} className="text-xs text-ink-500">
          {t('admin.tables.printInactive')}
        </p>
      )}
    </motion.li>
  )
}
