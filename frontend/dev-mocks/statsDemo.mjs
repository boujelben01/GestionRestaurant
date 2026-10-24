// Historique FICTIF et DÉTERMINISTE pour les statistiques admin du mock (~60 jours de commandes
// terminées/annulées + clients créés au fil du temps). Aucune valeur aléatoire non seedée :
// PRNG mulberry32 à graine fixe ; seule la date de référence (aujourd'hui à Tunis) varie.
// Ces données restent hors de db.orders : elles ne servent qu'aux routes /api/admin/statistiques.

export const HISTORY_DAYS = 60
const SEED = 20240611
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const TUNIS_OFFSET_MS = HOUR_MS // UTC+1 fixe, pas d'heure d'été

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Commandes par jour selon le jour de semaine (0 = dimanche) : creux le dimanche, week-end fort.
const BASE_VOLUME = [3, 19, 20, 21, 22, 26, 29]
// Poids horaires (heure locale de Tunis) : pics 12h-14h et 19h-22h.
const HOUR_WEIGHTS = [
  [10, 1],
  [11, 3],
  [12, 9],
  [13, 10],
  [14, 6],
  [15, 2],
  [16, 1],
  [17, 2],
  [18, 4],
  [19, 8],
  [20, 10],
  [21, 9],
  [22, 4],
  [23, 1],
]
// Plats plus fréquents (brik, lablabi, makloub, chawarma...) ; les autres pèsent 1.5.
const ARTICLE_WEIGHTS = {
  101: 8,
  102: 5,
  201: 7,
  202: 4,
  401: 7,
  402: 7,
  403: 3,
  404: 5,
  501: 3,
  702: 3,
  701: 2,
}
const GHOST_NAMES = [
  'Ancien plat Mloukhia',
  'Ancien plat Spaghetti',
  'Ancien plat Burger maison',
  'Ancien plat Salade niçoise',
]
const CLIENT_NAMES = [
  'Hedi Triki',
  'Sana Mejri',
  'Oussama Dridi',
  'Lina Ferchichi',
  'Bilel Sassi',
  'Yosra Khemiri',
  'Anis Zouari',
  'Meriem Hajji',
  'Fares Ayari',
  'Dorra Nasri',
  'Skander Bouslama',
  'Emna Louati',
  'Tarek Mabrouk',
  'Hanen Cherif',
  'Mehdi Rezgui',
  'Asma Belhaj',
  'Zied Karray',
  'Olfa Jlassi',
  'Marwen Tlili',
  'Ghada Hammami',
  'Slim Mrabet',
  'Rania Dhaouadi',
  'Nizar Kacem',
  'Syrine Abidi',
]

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

function weighted(rand, entries) {
  const total = entries.reduce((n, [, w]) => n + w, 0)
  let x = rand() * total
  for (const [value, w] of entries) {
    if ((x -= w) < 0) return value
  }
  return entries[entries.length - 1][0]
}

/** AAAA-MM-JJ du jour civil de Tunis à l'instant donné. */
export const tunisDay = (ms) => new Date(ms + TUNIS_OFFSET_MS).toISOString().slice(0, 10)

/**
 * @param {{ articles: object[], fraisLivraison: number, nowMs: number }} p
 * @returns {{ orders: object[], clients: object[] }} orders au format db.orders (sans historique de statuts)
 */
export function generateHistory({ articles, fraisLivraison, nowMs }) {
  const rand = mulberry32(SEED)
  const today = tunisDay(nowMs)
  const todayMidnightUtc = Date.parse(`${today}T00:00:00+01:00`)
  const orderable = articles.filter((a) => a.estActif && a.estDisponible)
  const articlePool = orderable.map((a) => [a, ARTICLE_WEIGHTS[a.id] ?? 1.5])
  const orders = []
  let nextId = 1

  for (let back = HISTORY_DAYS; back >= 0; back--) {
    const dayStartUtc = todayMidnightUtc - back * DAY_MS
    const dow = new Date(dayStartUtc + TUNIS_OFFSET_MS).getUTCDay()
    const count = Math.max(1, BASE_VOLUME[dow] + Math.floor(rand() * 7) - 3)
    for (let i = 0; i < count; i++) {
      const hour = weighted(rand, HOUR_WEIGHTS)
      const at = dayStartUtc + hour * HOUR_MS + Math.floor(rand() * 3_600_000)
      if (at > nowMs) continue // pas de commande dans le futur (aujourd'hui)
      const typeCommande = weighted(rand, [
        ['ARemporter', 45],
        ['SurPlace', 35],
        ['Livraison', 20],
      ])
      const lignes = []
      const nLines = 1 + Math.floor(rand() * 4)
      for (let l = 0; l < nLines; l++) {
        const quantite = rand() < 0.7 ? 1 : rand() < 0.75 ? 2 : 3
        if (rand() < 0.04) {
          const nom = GHOST_NAMES[Math.floor(rand() * GHOST_NAMES.length)]
          const prixUnitaire = 6 + Math.floor(rand() * 19) * 0.5
          lignes.push({ articleId: null, nomFr: nom, nomAr: nom, prixUnitaire, quantite })
        } else {
          const a = weighted(rand, articlePool)
          lignes.push({
            articleId: a.id,
            nomFr: a.nomFr,
            nomAr: a.nomAr,
            prixUnitaire: a.prix,
            quantite,
          })
        }
      }
      const sousTotal = round2(lignes.reduce((n, l) => n + round2(l.prixUnitaire * l.quantite), 0))
      const frais = typeCommande === 'Livraison' ? round2(fraisLivraison) : 0
      const annulee = rand() < 0.06
      const recent = back <= 1
      orders.push({
        id: nextId++,
        dateCommande: new Date(at).toISOString(),
        statut: annulee ? 'Annulee' : 'Terminee',
        typeCommande,
        estPayee: !annulee && !(recent && rand() < 0.03),
        sousTotal,
        fraisLivraison: frais,
        total: round2(sousTotal + frais),
        lignes,
      })
    }
  }

  const clients = CLIENT_NAMES.map((nom, i) => {
    const day = Math.floor(((i + rand() * 0.9) / CLIENT_NAMES.length) * HISTORY_DAYS)
    const at =
      todayMidnightUtc - (HISTORY_DAYS - day) * DAY_MS + (8 + Math.floor(rand() * 14)) * HOUR_MS
    return {
      id: `u-hist-${i + 1}`,
      nom,
      roles: ['Client'],
      dateCreation: new Date(Math.min(at, nowMs)).toISOString(),
    }
  })
  return { orders, clients }
}
