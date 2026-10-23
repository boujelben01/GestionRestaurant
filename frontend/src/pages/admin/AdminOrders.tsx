import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { Tabs, panelId, tabId } from '@/components/ui'
import { useActiveOrders, useOrderCounters } from '@/features/admin/orders/api'
import { ActiveBoard } from '@/features/admin/orders/ActiveBoard'
import { OrderHistory } from '@/features/admin/orders/OrderHistory'

type View = 'active' | 'history'

export default function AdminOrders() {
  const { t } = useTranslation()
  const [view, setView] = useState<View>('active')
  const { data: counters } = useOrderCounters()
  const { data: active } = useActiveOrders()
  // Titre d'onglet : « (3) Commandes » tant que des commandes attendent.
  const waiting = counters?.enAttente ?? active?.filter((o) => o.statut === 'EnAttente').length ?? 0
  const title = waiting > 0 ? `(${waiting}) ${t('admin.nav.orders')}` : t('admin.nav.orders')

  return (
    <>
      <Seo title={title} noindex />
      <div className="flex flex-col gap-5">
        <Tabs
          tabs={[
            { id: 'active', label: t('admin.orders.viewActive') },
            { id: 'history', label: t('admin.orders.viewHistory') },
          ]}
          value={view}
          onChange={setView}
          label={t('admin.orders.views')}
          idPrefix="orders"
          className="max-w-md"
        />
        {/* Le tableau reste monté (masqué) pour continuer à détecter les nouvelles commandes. */}
        <div
          role="tabpanel"
          id={panelId('orders', 'active')}
          aria-labelledby={tabId('orders', 'active')}
          hidden={view !== 'active'}
        >
          <ActiveBoard />
        </div>
        {view === 'history' && (
          <div
            role="tabpanel"
            id={panelId('orders', 'history')}
            aria-labelledby={tabId('orders', 'history')}
          >
            <OrderHistory />
          </div>
        )}
      </div>
    </>
  )
}
