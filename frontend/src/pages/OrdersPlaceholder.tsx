import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { PageHeader } from '@/components/layout/PageHeader'

/**
 * Pages protégées dont le contenu arrive à l'étape F4 (/commandes, /commandes/:id, /profil) :
 * ce placeholder évite des liens cassés dans l'en-tête.
 */
function Placeholder({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation()
  return (
    <>
      <Seo title={t(titleKey)} noindex />
      <PageHeader title={t(titleKey)} subtitle={t('common.comingSoon')} />
    </>
  )
}

export function OrdersPlaceholder() {
  return <Placeholder titleKey="nav.orders" />
}

export function OrderDetailPlaceholder() {
  return <Placeholder titleKey="nav.orders" />
}

export function ProfilePlaceholder() {
  return <Placeholder titleKey="nav.profile" />
}
