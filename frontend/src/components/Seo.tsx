import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

/** Image de partage par défaut (légère, déjà présente ; les scrapers n'acceptent pas le SVG). */
export const DEFAULT_OG_IMAGE = '/images/lablabi.webp'

interface SeoProps {
  /** Titre de la page ; le nom de la marque est ajouté. Absent = page d'accueil. */
  title?: string
  description?: string
  /** Chemin ou URL absolue de l'image Open Graph. */
  image?: string
  type?: 'website' | 'article'
  noindex?: boolean
}

/** Métadonnées de page : <title>, description, Open Graph, <html lang dir>. À mettre dans chaque page. */
export function Seo({
  title,
  description,
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  noindex,
}: SeoProps) {
  const { t } = useTranslation()
  const brand = t('brand.name')
  const fullTitle = title ? `${title} · ${brand}` : brand
  const text = description ?? t('brand.description')
  const imageUrl = image.startsWith('http') ? image : `${window.location.origin}${image}`

  return (
    <Helmet>
      <html lang="fr" dir="ltr" />
      <title>{fullTitle}</title>
      <meta name="description" content={text} />
      {noindex && <meta name="robots" content="noindex" />}
      <meta property="og:site_name" content={brand} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={text} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:locale" content="fr_TN" />
      <meta name="twitter:card" content="summary_large_image" />
    </Helmet>
  )
}
