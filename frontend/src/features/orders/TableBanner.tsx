import { useTranslation } from 'react-i18next'
import { TableIcon } from '@/components/ui'
import { leaveTable, useTableSession } from './useTableSession'

/** Bandeau discret « Vous êtes à la table N » (annoncé poliment) avec sortie de la table. */
export function TableBanner() {
  const { t } = useTranslation()
  const table = useTableSession()
  return (
    <div role="status" aria-live="polite">
      {table && (
        <div className="border-b border-sidi-600/20 bg-sidi-100 text-sidi-700">
          <div className="container-page flex min-h-11 flex-wrap items-center justify-between gap-x-4 text-sm font-semibold">
            <p className="flex items-center gap-2 py-2">
              <TableIcon className="size-5" />
              {t('table.banner', { number: table.numero })}
            </p>
            <button
              type="button"
              onClick={leaveTable}
              className="inline-flex min-h-11 items-center rounded-full px-2 underline underline-offset-4 hover:bg-sidi-600/10"
            >
              {t('table.leave')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
