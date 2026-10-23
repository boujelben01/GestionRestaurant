export const FALLBACK_IMAGE = '/images/default.svg'

/**
 * Photos du dossier public/images trop lourdes (6-7 Mo) : on ne les affiche pas tant
 * qu'elles ne sont pas compressées (WebP, 1200 px max). Le menu retombe sur default.svg.
 * TODO : retirer un nom de cette liste une fois la version compressée en place.
 */
const HEAVY_IMAGES = new Set(['chawarma.jpg', 'assiette-chawarma.jpg'])

/** URL d'image à afficher pour un article (repli si absente ou trop lourde). */
export function resolveImage(imageUrl: string | null | undefined): string {
  if (!imageUrl) return FALLBACK_IMAGE
  const file = imageUrl.split('/').pop()?.toLowerCase() ?? ''
  return HEAVY_IMAGES.has(file) ? FALLBACK_IMAGE : imageUrl
}
