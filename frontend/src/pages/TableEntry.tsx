import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { Button, ErrorState, PlateIcon, Skeleton, ZelligePattern } from '@/components/ui'
import { fetchTable } from '@/features/orders/api'
import { isValidTableCode } from '@/features/orders/tableSession'
import { rememberTable } from '@/features/orders/useTableSession'
import { toAppError } from '@/lib/errors'

/** /table/:code : valide le code (QR), mémorise la table puis ouvre le menu. */
export default function TableEntry() {
  const { t } = useTranslation()
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const valid = isValidTableCode(code)

  const { data, error, isPending, refetch, isFetching } = useQuery({
    queryKey: ['table', code],
    queryFn: () => fetchTable(code),
    enabled: valid,
    retry: false,
    staleTime: 0,
  })

  useEffect(() => {
    if (!data) return
    rememberTable({ code, numero: data.numero })
    void navigate('/menu', { replace: true })
  }, [data, code, navigate])

  const notFound = !valid || (error !== null && toAppError(error).status === 404)
  const failed = !notFound && error !== null

  return (
    <section className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-16 text-center">
      <Seo title={t('table.title')} noindex />
      <ZelligePattern className="-z-10 text-terracotta-600 opacity-[0.07]" size={72} />
      <div className="max-w-lg">
        {notFound && (
          <>
            <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-white text-3xl text-terracotta-600 shadow-soft">
              <PlateIcon />
            </div>
            <h1 className="text-3xl sm:text-4xl">{t('table.notFoundTitle')}</h1>
            <p className="mt-3 text-ink-700">{t('table.notFoundText')}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button to="/menu">{t('common.seeMenu')}</Button>
            </div>
          </>
        )}
        {failed && (
          <ErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} />
        )}
        {valid && isPending && !failed && (
          <div
            role="status"
            aria-label={t('table.checking')}
            className="flex flex-col items-center gap-4"
          >
            <Skeleton className="size-16 rounded-full" />
            <p className="text-ink-700">{t('table.checking')}</p>
          </div>
        )}
      </div>
    </section>
  )
}
