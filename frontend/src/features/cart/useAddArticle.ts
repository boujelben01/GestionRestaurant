import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import type { MenuArticle } from '@/lib/types'
import { useAddToCart, usePanier } from './api'
import { cartErrorMessage } from './cartErrors'
import { quantityOf } from './cartMath'

/**
 * Câblage de « Ajouter » : invité vers /connexion (retour via state.from) ; connecté : ajout
 * optimiste, toast de succès avec l'action « Voir le panier », toast d'erreur traduit sinon.
 */
export function useAddArticle() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { add, isPending, pendingArticleId } = useAddToCart()
  const { data: cart } = usePanier()

  const addArticle = async (article: MenuArticle) => {
    if (!article.disponible) return
    if (!isAuthenticated) {
      void navigate('/connexion', { state: { from: location.pathname + location.search } })
      return
    }
    try {
      const added = await add({
        article: {
          id: article.id,
          nom: article.nom,
          prix: article.prix,
          imageUrl: article.imageUrl,
          disponible: article.disponible,
        },
      })
      if (added) {
        toast(t('cart.added', { name: article.nom }), {
          variant: 'success',
          action: { label: t('cart.view'), onClick: () => void navigate('/panier') },
        })
      }
    } catch (error) {
      toast(cartErrorMessage(error, t), { variant: 'error' })
    }
  }

  return {
    addArticle,
    isAdding: (articleId: number) => isPending && pendingArticleId === articleId,
    quantityInCart: (articleId: number) => quantityOf(cart, articleId),
  }
}
