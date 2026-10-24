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

// --- Administration (Features/Commandes/Admin, Menu/Admin, Restaurant, Admin) ---

export interface AdminOrderSummary {
  id: number
  numero: string
  statut: StatutCommande
  typeCommande: TypeCommande
  nomClient: string
  telephone: string
  tableNumero: number | null
  total: number
  estPayee: boolean
  nombreArticles: number
  dateCommande: string
  dateMiseAJour: string
}

export interface ActiveOrderLine {
  nomFr: string
  nomAr: string
  quantite: number
}

/** Réponse de GET /api/admin/commandes/actives : volontairement réduite (voir AdminOrder pour le reste). */
export interface ActiveOrder {
  id: number
  numero: string
  statut: StatutCommande
  typeCommande: TypeCommande
  nomClient: string
  tableNumero: number | null
  note: string | null
  dateCommande: string
  dateMiseAJour: string
  lignes: ActiveOrderLine[]
  /** Jeton de concurrence (xmin) à renvoyer dans PATCH .../statut. */
  version: number
}

export interface AdminOrderLine {
  articleId: number | null
  nomFr: string
  nomAr: string
  prixUnitaire: number
  quantite: number
  totalLigne: number
}

export interface AdminOrderHistory {
  statut: StatutCommande
  date: string
  parUserId: string | null
  parNom: string | null
}

export interface AdminOrder {
  id: number
  numero: string
  statut: StatutCommande
  statutsSuivants: StatutCommande[]
  typeCommande: TypeCommande
  modePaiement: string
  estPayee: boolean
  sousTotal: number
  fraisLivraison: number
  total: number
  note: string | null
  adresseLivraison: string | null
  tableNumero: number | null
  client: { userId: string | null; nom: string; telephone: string }
  dateCommande: string
  dateMiseAJour: string
  lignes: AdminOrderLine[]
  historique: AdminOrderHistory[]
  version: number
}

export interface OrderCounters {
  /** Journée civile du restaurant (AAAA-MM-JJ, Africa/Tunis). */
  date: string
  parStatut: Array<{ statut: StatutCommande; nombre: number }>
  totalAujourdhui: number
  /** Commandes EnAttente toutes dates confondues. */
  enAttente: number
}

export interface AdminCategory {
  id: number
  nomFr: string
  nomAr: string
  ordre: number
  estActive: boolean
  nombreArticlesActifs: number
}

export interface AdminArticle {
  id: number
  categorieId: number
  nomFr: string
  nomAr: string
  descriptionFr: string | null
  descriptionAr: string | null
  prix: number
  imageUrl: string | null
  estDisponible: boolean
  estActif: boolean
  estPopulaire: boolean
  ordre: number
  dateCreation: string
  dateMiseAJour: string
}

export interface AdminUser {
  id: string
  userName: string
  email: string
  nom: string | null
  estActif: boolean
  dateCreation: string
}

export interface AdminTable {
  id: number
  numero: number
  /** GUID encodé dans le QR code (/table/{code}). */
  code: string
  capacite: number
  estActive: boolean
}

// --- Plan de salle (Features/Tables/Salle*) ---

export type EtatTable = 'Libre' | 'Occupee' | 'AEncaisser' | 'Inactive'

export interface SalleOrder {
  id: number
  numero: string
  statut: StatutCommande
  total: number
  estPayee: boolean
  dateCommande: string
}

export interface SalleTable {
  id: number
  numero: number
  capacite: number
  estActive: boolean
  etat: EtatTable
  /** Somme des commandes non payées et non annulées de la table. */
  totalAEncaisser: number
  nombreCommandes: number
  /** Plus ancienne commande à suivre (début de l'occupation), null si aucune. */
  premiereCommandeUtc: string | null
  commandes: SalleOrder[]
}
