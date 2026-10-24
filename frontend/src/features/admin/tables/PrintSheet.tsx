import { createPortal } from 'react-dom'
import type { AdminTable } from '@/lib/types'

interface PrintSheetProps {
  restaurantName: string
  tables: readonly AdminTable[]
  /** URL encodée par table (id → URL) et image du QR prête (URL → data URI). */
  urlOf: (table: AdminTable) => string
  images: Record<string, string>
}

/**
 * Feuille d'impression : une fiche par table (saut de page entre deux fiches). Invisible à l'écran
 * (`hidden`), seule visible à l'impression (`print:block`) : le CSS d'impression masque tout le reste.
 * Les deux langues sont toujours imprimées, quelle que soit la langue de l'interface. Rendue dans
 * <body> pour pouvoir masquer simplement ses frères.
 */
export function PrintSheet({ restaurantName, tables, urlOf, images }: PrintSheetProps) {
  return createPortal(
    <div data-print-sheet className="hidden print:block">
      {tables.map((table) => {
        const url = urlOf(table)
        return (
          <section
            key={table.id}
            data-print-table={table.numero}
            className="print-fiche flex flex-col items-center justify-center gap-6 text-center text-black"
          >
            <p className="text-3xl font-semibold tracking-wide">{restaurantName}</p>
            <h2 className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-display text-[72px] leading-none font-bold">
              <span lang="fr">Table {table.numero}</span>
              <span aria-hidden="true" className="font-normal text-neutral-400">
                ·
              </span>
              <span lang="ar" dir="rtl">
                الطاولة {table.numero}
              </span>
            </h2>
            {images[url] && (
              <img
                src={images[url]}
                alt={`QR code - Table ${table.numero}`}
                width={416}
                height={416}
                className="print-qr"
              />
            )}
            <p lang="fr" className="text-3xl font-semibold">
              Scannez pour commander
            </p>
            <p lang="ar" dir="rtl" className="text-3xl font-semibold">
              امسح الكود وأطلب من طاولتك
            </p>
            <p dir="ltr" className="max-w-[16cm] text-xs break-all text-neutral-600">
              {url}
            </p>
          </section>
        )
      })}
    </div>,
    document.body,
  )
}
