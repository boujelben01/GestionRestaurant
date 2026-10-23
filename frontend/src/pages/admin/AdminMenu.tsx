import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { Tabs, panelId, tabId } from '@/components/ui'
import { ArticlesPanel } from '@/features/admin/menu/ArticlesPanel'
import { CategoriesPanel } from '@/features/admin/menu/CategoriesPanel'

type View = 'articles' | 'categories'

export default function AdminMenu() {
  const { t } = useTranslation()
  const [view, setView] = useState<View>('articles')
  return (
    <>
      <Seo title={t('admin.nav.menu')} noindex />
      <div className="flex flex-col gap-5">
        <Tabs
          tabs={[
            { id: 'articles', label: t('admin.menu.articles') },
            { id: 'categories', label: t('admin.menu.categories') },
          ]}
          value={view}
          onChange={setView}
          label={t('admin.nav.menu')}
          idPrefix="menu"
          className="max-w-md"
        />
        <div role="tabpanel" id={panelId('menu', view)} aria-labelledby={tabId('menu', view)}>
          {view === 'articles' ? <ArticlesPanel /> : <CategoriesPanel />}
        </div>
      </div>
    </>
  )
}
