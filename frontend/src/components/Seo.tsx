import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useDir, useLang } from '@/lib/useLang'

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

const OG_LOCALES = { fr: 'fr_TN', ar: 'ar_TN' } as const

/** Métadonnées de page : <title>, description, Open Graph, <html lang dir>. À mettre dans chaque page. */
export function Seo({
  title,
  description,
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  noindex,
}: SeoProps) {
  const { t } = useTranslation()
  const lang = useLang()
  const dir = useDir()
  const brand = t('brand.name')
  const fullTitle = title ? `${title} · ${brand}` : `${brand} · ${t('brand.tagline')}`
  const text = description ?? t('brand.description')
  const imageUrl = image.startsWith('http') ? image : `${window.location.origin}${image}`
  const alternate = OG_LOCALES[lang === 'fr' ? 'ar' : 'fr']

  return (
    <Helmet>
      <html lang={lang} dir={dir} />
      <title>{fullTitle}</title>
      <meta name="description" content={text} />
      {noindex && <meta name="robots" content="noindex" />}
      <meta property="og:site_name" content={brand} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={text} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:locale" content={OG_LOCALES[lang]} />
      <meta property="og:locale:alternate" content={alternate} />
      <meta name="twitter:card" content="summary_large_image" />
    </Helmet>
  )
}
