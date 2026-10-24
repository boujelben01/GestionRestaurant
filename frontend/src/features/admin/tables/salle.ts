import type { EtatTable, SalleOrder, SalleTable, StatutCommande } from '@/lib/types'

/**
 * Règles du plan de salle, miroir de SalleService côté back-end. L'état affiché vient TOUJOURS du serveur
 * (GET /api/admin/tables/salle) ; ces fonctions ne servent qu'aux mises à jour optimistes et aux explications.
 */

export const isInProgress = (statut: StatutCommande) =>
  statut === 'EnAttente' || statut === 'EnPreparation' || statut === 'Prete'

/** Commande à suivre sur une table : ni annulée, ni terminée-et-payée. */
export const isTracked = (statut: StatutCommande, estPayee: boolean) =>
  statut !== 'Annulee' && !(statut === 'Terminee' && estPayee)

export function computeEtat(estActive: boolean, commandes: readonly SalleOrder[]): EtatTable {
  if (!estActive) return 'Inactive'
  if (commandes.some((c) => isInProgress(c.statut))) return 'Occupee'
  return commandes.some((c) => !c.estPayee) ? 'AEncaisser' : 'Libre'
}

/** Ce qui empêche de libérer la table (le serveur reste l'autorité : un 409 est toujours possible). */
export interface ReleaseBlockers {
  /** Commandes EnAttente ou EnPreparation. */
  inProgress: number
  /** Commandes non payées (non annulées). */
  unpaid: number
}

export function releaseBlockers(table: Pick<SalleTable, 'commandes'>): ReleaseBlockers {
  return {
    inProgress: table.commandes.filter(
      (c) => c.statut === 'EnAttente' || c.statut === 'EnPreparation',
    ).length,
    unpaid: table.commandes.filter((c) => !c.estPayee).length,
  }
}

export const canRelease = (table: Pick<SalleTable, 'commandes'>) => {
  const b = releaseBlockers(table)
  return b.inProgress === 0 && b.unpaid === 0
}

/** Y a-t-il quelque chose à encaisser ? (sinon le serveur répond 409). */
export const canCollect = (table: Pick<SalleTable, 'commandes'>) =>
  table.commandes.some((c) => !c.estPayee)

const rebuild = (table: SalleTable, commandes: SalleOrder[]): SalleTable => {
  const tracked = commandes.filter((c) => isTracked(c.statut, c.estPayee))
  const dates = tracked.map((c) => new Date(c.dateCommande).getTime())
  return {
    ...table,
    commandes: tracked,
    nombreCommandes: tracked.length,
    totalAEncaisser: round2(tracked.filter((c) => !c.estPayee).reduce((n, c) => n + c.total, 0)),
    premiereCommandeUtc: tracked.length === 0 ? null : new Date(Math.min(...dates)).toISOString(),
    etat: computeEtat(table.estActive, tracked),
  }
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Aperçu optimiste de « Encaisser » : toutes les commandes suivies deviennent payées. */
export function applyCollect(table: SalleTable): SalleTable {
  return rebuild(
    table,
    table.commandes.map((c) => ({ ...c, estPayee: true })),
  )
}

/**
 * Aperçu optimiste de « Libérer » : si rien ne bloque, les commandes prêtes passent « Terminee » et la
 * table se libère ; sinon l'état affiché ne change pas (le serveur refusera avec un 409 explicite).
 */
export function applyRelease(table: SalleTable): SalleTable {
  if (!canRelease(table)) return table
  return rebuild(
    table,
    table.commandes.map((c) => (c.statut === 'Prete' ? { ...c, statut: 'Terminee' as const } : c)),
  )
}

export interface SalleSummary {
  libres: number
  occupees: number
  aEncaisser: number
  inactives: number
}

/** Résumé en tête de page : tables libres / occupées / à encaisser (+ inactives). */
export function salleSummary(tables: readonly Pick<SalleTable, 'etat'>[]): SalleSummary {
  const count = (etat: EtatTable) => tables.filter((t) => t.etat === etat).length
  return {
    libres: count('Libre'),
    occupees: count('Occupee'),
    aEncaisser: count('AEncaisser'),
    inactives: count('Inactive'),
  }
}

/** Durée d'occupation en minutes depuis la plus ancienne commande suivie (null si aucune). */
export function occupationMinutes(
  premiereCommandeUtc: string | null,
  now: number = Date.now(),
): number | null {
  if (!premiereCommandeUtc) return null
  return Math.max(0, Math.floor((now - new Date(premiereCommandeUtc).getTime()) / 60_000))
}
