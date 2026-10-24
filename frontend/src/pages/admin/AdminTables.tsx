import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { Tabs, panelId, tabId } from '@/components/ui'
import { GestionView } from '@/features/admin/tables/GestionView'
import { SalleView } from '@/features/admin/tables/SalleView'

type View = 'salle' | 'gestion'

/** Tables : « Salle » (service en cours, par défaut) et « Gestion » (QR codes, ajout, impression). */
export default function AdminTables() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const view: View = params.get('vue') === 'gestion' ? 'gestion' : 'salle'
  const setView = (next: View) => setParams({ vue: next }, { replace: true })

  return (
    <>
      <Seo title={t('admin.nav.tables')} noindex />
      <div className="flex flex-col gap-5">
        <Tabs
          tabs={[
            { id: 'salle', label: t('admin.tables.salle.tab') },
            { id: 'gestion', label: t('admin.tables.gestionTab') },
          ]}
          value={view}
          onChange={setView}
          label={t('admin.nav.tables')}
          idPrefix="tables"
          className="max-w-md"
        />
        <div role="tabpanel" id={panelId('tables', view)} aria-labelledby={tabId('tables', view)}>
          {view === 'salle' ? (
            <SalleView onGoToGestion={() => setView('gestion')} />
          ) : (
            <GestionView />
          )}
        </div>
      </div>
    </>
  )
}
