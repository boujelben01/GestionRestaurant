import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Lang, MenuCategorie } from '@/lib/types'
import { useLang } from '@/lib/useLang'

export async function fetchMenu(lang: Lang): Promise<MenuCategorie[]> {
  const { data } = await api.get<MenuCategorie[]>('/api/menu', { params: { lang } })
  return data
}

/** Menu complet dans la langue active ; la clé inclut la langue pour re-télécharger au changement. */
export function useMenu() {
  const lang = useLang()
  return useQuery({
    queryKey: ['menu', lang],
    queryFn: () => fetchMenu(lang),
  })
}
