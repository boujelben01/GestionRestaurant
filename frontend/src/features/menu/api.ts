import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { MenuCategorie } from '@/lib/types'

export async function fetchMenu(): Promise<MenuCategorie[]> {
  const { data } = await api.get<MenuCategorie[]>('/api/menu')
  // Une catégorie sans article ne s'affiche pas (défense : l'API ne devrait déjà pas la renvoyer).
  return data.filter((category) => category.articles.length > 0)
}

/** Menu complet. */
export function useMenu() {
  return useQuery({
    queryKey: ['menu'],
    queryFn: () => fetchMenu(),
  })
}
