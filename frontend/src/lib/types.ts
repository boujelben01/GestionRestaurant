/** Types du contrat de l'API Resto (voir README racine et Resto.Api.http). */

export type Lang = 'fr' | 'ar'

export type TypeCommande = 'SurPlace' | 'ARemporter' | 'Livraison'
export type StatutCommande = 'EnAttente' | 'EnPreparation' | 'Prete' | 'Terminee' | 'Annulee'

// --- Auth ---
export interface User {
  id: string
  userName: string
  nom: string | null
  email: string
  telephone: string | null
  roles: string[]
  langueFavorite: Lang
}

export interface LoginRequest {
  identifiant: string
  password: string
}

export interface LoginResponse {
  token: string
  expiresAtUtc: string
  user: User
}

export interface RegisterRequest {
  nom: string
  email: string
  password: string
  userName?: string
  telephone?: string
  langueFavorite?: Lang
}

// --- Menu ---
export interface MenuArticle {
  id: number
  categorieId: number
  nom: string
  description: string | null
  prix: number
  imageUrl: string | null
  estPopulaire: boolean
  disponible: boolean
}

export interface MenuCategorie {
  id: number
  nom: string
  ordre: number
  articles: MenuArticle[]
}

// --- Restaurant ---
export interface Horaire {
  /** 0 = dimanche … 6 = samedi */
  jourSemaine: number
  /** « HH:mm » */
  ouverture: string | null
  fermeture: string | null
  estFerme: boolean
}

export interface Restaurant {
  nom: string
  telephone: string
  email: string
  adresse: string
  fraisLivraison: number
  montantMinimumLivraison: number
  commandesOuvertes: boolean
  horaires: Horaire[]
  ouvertMaintenant: boolean
}

// --- Panier ---
export interface PanierLigne {
  articleId: number
  nom: string
  prixUnitaire: number
  imageUrl: string | null
  disponible: boolean
  quantite: number
  totalLigne: number
  avertissement: 'inactif' | 'indisponible' | null
}

export interface Panier {
  lignes: PanierLigne[]
  nombreArticles: number
  sousTotal: number
  dateMiseAJour: string | null
}

// --- Commandes ---
export interface CreerCommandeRequest {
  typeCommande: TypeCommande
  telephone: string
  note?: string
  adresseLivraison?: string
  tableCode?: string
}

export interface CommandeLigne {
  articleId: number | null
  nomFr: string
  nomAr: string
  prixUnitaire: number
  quantite: number
  totalLigne: number
}

export interface HistoriqueStatut {
  statut: StatutCommande
  date: string
}

export interface CommandeResume {
  id: number
  numero: string
  statut: StatutCommande
  typeCommande: TypeCommande
  total: number
  nombreArticles: number
  dateCommande: string
}

export interface Commande {
  id: number
  numero: string
  statut: StatutCommande
  typeCommande: TypeCommande
  modePaiement: string
  estPayee: boolean
  sousTotal: number
  fraisLivraison: number
  total: number
  note: string | null
  adresseLivraison: string | null
  tableNumero: number | null
  dateCommande: string
  lignes: CommandeLigne[]
  historique: HistoriqueStatut[]
}

export interface TableResponse {
  numero: number
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}
