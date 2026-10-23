import { ArticleCard } from '@/features/menu/ArticleCard'
import type { MenuArticle } from '@/lib/types'
import { useAddArticle } from './useAddArticle'

/**
 * ArticleCard branchée sur le panier (auth, ajout, navigation, toasts). Les pages utilisent
 * celle-ci ; ArticleCard reste pure et testable sans provider.
 */
export function ConnectedArticleCard({
  article,
  className,
}: {
  article: MenuArticle
  className?: string
}) {
  const { addArticle, isAdding, quantityInCart } = useAddArticle()
  return (
    <ArticleCard
      article={article}
      className={className}
      onAdd={(a) => void addArticle(a)}
      adding={isAdding(article.id)}
      inCartQuantity={quantityInCart(article.id)}
    />
  )
}
