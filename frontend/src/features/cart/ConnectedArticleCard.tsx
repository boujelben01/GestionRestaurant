import { useFavoriteToggle } from '@/features/favorites/useFavoriteToggle'
import { ArticleCard } from '@/features/menu/ArticleCard'
import type { MenuArticle } from '@/lib/types'
import { useAddArticle } from './useAddArticle'

/**
 * ArticleCard branchée sur le panier et les favoris (auth, ajout, navigation, toasts). Les pages utilisent
 * celle-ci ; ArticleCard reste pure et testable sans provider.
 */
export function ConnectedArticleCard({
  article,
  unlisted = false,
  className,
}: {
  article: MenuArticle
  /** Article retiré du menu public (liste de favoris). */
  unlisted?: boolean
  className?: string
}) {
  const { addArticle, isAdding, quantityInCart } = useAddArticle()
  const { onToggleFavorite, isFavorite } = useFavoriteToggle()
  return (
    <ArticleCard
      article={article}
      className={className}
      unlisted={unlisted}
      onAdd={unlisted ? undefined : (a) => void addArticle(a)}
      adding={isAdding(article.id)}
      inCartQuantity={quantityInCart(article.id)}
      isFavorite={isFavorite(article.id)}
      onToggleFavorite={onToggleFavorite}
    />
  )
}
