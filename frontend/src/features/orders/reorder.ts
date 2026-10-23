import type { QueryClient } from '@tanstack/react-query'
import { fetchMenu } from '@/features/menu/api'
import { api } from '@/lib/api'
import type { Commande, Lang, MenuArticle, Panier } from '@/lib/types'
import { MAX_QUANTITY } from '@/features/cart/cartMath'

export type SkipReason = 'unavailable' | 'removed' | 'error' | 'noArticle'

export interface ReorderResult {
  added: Array<{ nom: string; quantite: number }>
  skipped: Array<{ nom: string; reason: SkipReason }>
  /** Dernier panier renvoyé par le serveur, pour le cache. */
  cart: Panier | null
}

/**
 * « Commander à nouveau » : repasse chaque ligne dont ArticleId n'est pas nul dans le panier,
 * seulement si l'article est encore au menu ET disponible. Le prix est celui d'aujourd'hui
 * (jamais celui de l'ancienne commande). Les lignes ajoutées une à une s'ajoutent à l'existant.
 */
export async function reorder(
  queryClient: QueryClient,
  order: Commande,
  lang: Lang,
): Promise<ReorderResult> {
  const menu = await queryClient.fetchQuery({
    queryKey: ['menu', lang],
    queryFn: () => fetchMenu(lang),
    staleTime: 0,
  })
  const articles = new Map<number, MenuArticle>(
    menu.flatMap((c) => c.articles).map((a) => [a.id, a]),
  )

  const result: ReorderResult = { added: [], skipped: [], cart: null }
  for (const ligne of order.lignes) {
    const nom = lang === 'ar' ? ligne.nomAr : ligne.nomFr
    if (ligne.articleId === null) {
      result.skipped.push({ nom, reason: 'noArticle' })
      continue
    }
    const article = articles.get(ligne.articleId)
    if (!article) {
      result.skipped.push({ nom, reason: 'removed' })
      continue
    }
    if (!article.disponible) {
      result.skipped.push({ nom: article.nom, reason: 'unavailable' })
      continue
    }
    try {
      const { data } = await api.post<Panier>(
        '/api/panier/items',
        { articleId: ligne.articleId, quantite: Math.min(ligne.quantite, MAX_QUANTITY) },
        { params: { lang } },
      )
      result.cart = data
      result.added.push({ nom: article.nom, quantite: ligne.quantite })
    } catch {
      // 409 (devenu indisponible entre-temps) ou autre : on continue avec les lignes suivantes.
      result.skipped.push({ nom: article.nom, reason: 'error' })
    }
  }
  return result
}
