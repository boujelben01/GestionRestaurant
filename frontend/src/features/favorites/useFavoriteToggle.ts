import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { cartErrorMessage } from '@/features/cart/cartErrors'
import type { MenuArticle } from '@/lib/types'
import { useFavoriteIds, useToggleFavorite } from './api'

/**
 * Câblage du cœur : invité vers /connexion (retour via state.from), client : bascule optimiste avec annonce
 * brève, erreur traduite ; administrateur : aucun cœur (`onToggle` indéfini).
 */
export function useFavoriteToggle() {
  const { t } = useTranslation()
  const { isAuthenticated, hasRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { data: ids } = useFavoriteIds()
  const { toggle } = useToggleFavorite()
  const isAdmin = isAuthenticated && hasRole('Admin')

  const onToggle = async (article: MenuArticle) => {
    if (!isAuthenticated) {
      void navigate('/connexion', { state: { from: location.pathname + location.search } })
      return
    }
    const favorite = !(ids ?? []).includes(article.id)
    try {
      const done = await toggle(article.id, favorite)
      if (done) {
        toast(t(favorite ? 'favorites.added' : 'favorites.removed', { name: article.nom }), {
          variant: 'info',
          duration: 2500,
        })
      }
    } catch (error) {
      toast(cartErrorMessage(error, t), { variant: 'error' })
    }
  }

  return {
    onToggleFavorite: isAdmin ? undefined : onToggle,
    isFavorite: (articleId: number) => (ids ?? []).includes(articleId),
  }
}
