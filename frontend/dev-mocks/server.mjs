// Faux back-end de développement, état EN MÉMOIRE (perdu au redémarrage) : menu, restaurant,
// auth, profil, panier, commandes, tables + routes ADMIN (commandes, catégories, articles,
// restaurant, utilisateurs). Reproduit les règles du vrai back-end (plafond 20, 409 indisponible,
// minimum de livraison, transitions de statut...). Hors bundle, aucune dépendance. Voir README.md.
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { generateHistory, tunisDay } from './statsDemo.mjs'

const PORT = Number(process.env.PORT ?? 5118)
const ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'
const load = (name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'))
// Catalogue du vrai back-end (source unique, lue aussi par `dotnet run -- --seed-catalog`).
const CATALOGUE_PATH = fileURLToPath(
  new URL('../../backend/src/Resto.Api/Data/catalogue.json', import.meta.url),
)

const TOKEN_TTL_MS = Number(process.env.TOKEN_TTL_MS ?? 3_600_000)
const MAX_QTY = 20
const MAX_PAGE_SIZE = 50
const MAX_ACTIVES = 200
const NUMERO_MAX = 9999
const CAPACITE_MAX = 50
// Tables initiales (le QR encode /table/<code>) ; copiées dans db.tables à chaque reset.
const INITIAL_TABLES = [
  { id: 1, numero: 1, code: '11111111-1111-4111-8111-111111111111', capacite: 4, estActive: true },
  { id: 2, numero: 5, code: '55555555-5555-4555-8555-555555555555', capacite: 6, estActive: true },
  { id: 3, numero: 2, code: '22222222-2222-4222-8222-222222222222', capacite: 2, estActive: true },
  { id: 4, numero: 3, code: '33333333-3333-4333-8333-333333333333', capacite: 4, estActive: false },
]
// Ordre de l'énumération StatutCommande du vrai back-end (cycle de vie, Annulee en dernier).
const STATUTS = ['EnAttente', 'EnPreparation', 'Prete', 'Terminee', 'Annulee']
const STATUS_FLOW = ['EnAttente', 'EnPreparation', 'Prete', 'Terminee']
const ACTIVE_STATUTS = ['EnAttente', 'EnPreparation', 'Prete']
const TYPES = ['SurPlace', 'ARemporter', 'Livraison']
const NEXT_STATUTS = {
  EnAttente: ['EnPreparation', 'Annulee'],
  EnPreparation: ['Prete', 'Annulee'],
  Prete: ['Terminee', 'Annulee'],
  Terminee: [],
  Annulee: [],
}

// ---------------------------------------------------------------------------------------------
// État en mémoire (menu rechargé depuis le catalogue du back-end, restaurant depuis fixtures/, à chaque reset)
// ---------------------------------------------------------------------------------------------
let categories // [{ id, nomFr, nomAr, ordre, estActive }]
let articles // [{ id, categorieId, nomFr, nomAr, descriptionFr, descriptionAr, prix, imageUrl,
//                estDisponible, estActif, estPopulaire, ordre, dateCreation, dateMiseAJour }]
let restaurant // { nom, telephone, email, adresse, fraisLivraison, montantMinimumLivraison, horaires }
let db

const toIso = (d) => new Date(d).toISOString()

/** Le catalogue n'a pas d'ids ni d'état actif : ids attribués ici, tout est actif, structure aplatie. */
function loadFixtures() {
  const stamp = toIso(Date.now())
  // Source unique du catalogue : le fichier du back-end. Les ids sont attribués dans l'ordre du fichier.
  const { categories: source } = JSON.parse(readFileSync(CATALOGUE_PATH, 'utf8'))
  let nextArticleId = 1
  categories = source.map((c, i) => ({
    id: i + 1,
    nomFr: c.nomFr,
    nomAr: c.nomAr,
    ordre: c.ordre,
    estActive: true,
  }))
  articles = source.flatMap((c, i) =>
    c.articles.map((a) => ({
      id: nextArticleId++,
      categorieId: i + 1,
      nomFr: a.nomFr,
      nomAr: a.nomAr,
      descriptionFr: a.descriptionFr ?? null,
      descriptionAr: a.descriptionAr ?? null,
      prix: a.prix,
      imageUrl: a.image ?? null,
      estDisponible: a.disponible,
      estActif: true,
      estPopulaire: a.populaire,
      ordre: a.ordre,
      dateCreation: stamp,
      dateMiseAJour: stamp,
    })),
  )
  const { commandesOuvertes, ...rest } = load('restaurant.json')
  restaurant = rest
  return commandesOuvertes ?? true
}

function resetDb() {
  const commandesOuvertes = loadFixtures()
  db = {
    users: [
      {
        id: 'u-client',
        userName: 'client',
        nom: 'Yazid',
        email: 'client@example.com',
        telephone: '+21620123456',
        password: 'MotDePasse123!',
        roles: ['Client'],
        langueFavorite: 'fr',
        estActif: true,
        dateCreation: '2026-01-05T08:00:00Z',
      },
      {
        id: 'u-admin',
        userName: 'admin',
        nom: 'Admin',
        email: 'admin@example.com',
        telephone: null,
        password: 'MotDePasse123!',
        roles: ['Admin'],
        langueFavorite: 'fr',
        estActif: true,
        dateCreation: '2026-01-01T08:00:00Z',
      },
      ...load('users.json').map((u, i) => ({
        id: `u-seed-${i + 1}`,
        ...u,
        password: 'MotDePasse123!',
        roles: ['Client'],
        langueFavorite: 'fr',
        estActif: true,
      })),
    ],
    sessions: new Map(), // token -> { userId, expires }
    carts: new Map(), // userId -> Map(articleId -> quantite)
    orders: [],
    // Historique fictif pour les statistiques UNIQUEMENT (hors db.orders) ; voir statsDemo.mjs.
    history: [],
    historyClients: [],
    nextOrderId: 1,
    tables: INITIAL_TABLES.map((t) => ({ ...t })),
    nextTableId: INITIAL_TABLES.length + 1,
    settings: {
      // Source de vérité de commandesOuvertes (GET /api/restaurant et PATCH admin).
      commandesOuvertes,
      forceClosed: false,
      // MOCK_ALWAYS_OPEN=1 : ignore les horaires (utile le dimanche ou la nuit).
      alwaysOpen: process.env.MOCK_ALWAYS_OPEN === '1',
    },
  }
  const demo = generateHistory({
    articles,
    fraisLivraison: restaurant.fraisLivraison,
    nowMs: Date.now(),
  })
  db.history = demo.orders
  db.historyClients = demo.clients
}
resetDb()

// ---------------------------------------------------------------------------------------------
// Helpers généraux
// ---------------------------------------------------------------------------------------------
const findArticle = (id) => articles.find((a) => a.id === id)
const findCategorie = (id) => categories.find((c) => c.id === id)
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
const nomOf = (u) => u.nom ?? u.userName
const pick = (fr, ar, lang) => (lang === 'ar' ? ar || fr : fr)
const byOrdre = (a, b) => a.ordre - b.ordre || a.id - b.id
const publicUser = (u) => ({
  id: u.id,
  userName: u.userName,
  nom: u.nom,
  email: u.email,
  telephone: u.telephone,
  roles: u.roles,
  langueFavorite: u.langueFavorite,
})

/** Visible côté public : article actif ET catégorie active (indisponible = visible mais disponible:false). */
const isVisible = (a) => a.estActif && Boolean(findCategorie(a.categorieId)?.estActive)
const isOrderable = (a) => isVisible(a) && a.estDisponible

/** Erreur RFC 7807 : à `throw` depuis une route. */
function problem(status, title, errors) {
  return { status, body: { status, title, ...(errors ? { errors } : {}) } }
}
const VALIDATION_TITLE = 'Une ou plusieurs erreurs de validation se sont produites.'
const fieldError = (field, message) => problem(400, VALIDATION_TITLE, { [field]: [message] })
/** Plusieurs erreurs de champ à la fois ; ne lance rien si `errors` est vide. */
function throwIfInvalid(errors) {
  if (Object.keys(errors).length) throw problem(400, VALIDATION_TITLE, errors)
}
const addError = (errors, field, message) => (errors[field] ??= []).push(message)

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const hasMax2Decimals = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6
/** Champ décimal 0..99999999.99, 2 décimales max (Range + MaxDecimalPlaces). */
function checkMoney(errors, field, value) {
  if (!isNum(value)) return addError(errors, field, 'Le champ est requis (nombre).')
  if (value < 0 || value > 99999999.99)
    addError(errors, field, 'La valeur doit être comprise entre 0 et 99999999.99.')
  if (!hasMax2Decimals(value)) addError(errors, field, 'Au maximum 2 décimales sont autorisées.')
}
/** Chaîne obligatoire (Required + StringLength). */
function checkRequiredString(errors, field, value, max) {
  if (typeof value !== 'string' || !value.trim()) addError(errors, field, 'Le champ est requis.')
  else if (value.length > max)
    addError(errors, field, `La taille maximale est de ${max} caractères.`)
}
function checkOptionalString(errors, field, value, max) {
  if (value != null && (typeof value !== 'string' || value.length > max))
    addError(errors, field, `La taille maximale est de ${max} caractères.`)
}

/** Reprise de Common/Validation/ImageUrlRules.cs. */
function isValidImageUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 500) return false
  if (value.startsWith('/images/'))
    return (
      /^\/images\/[A-Za-z0-9._\-/]+$/.test(value) &&
      !value.endsWith('/') &&
      !value.includes('//') &&
      !value.split('/').includes('..')
    )
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return false
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && Boolean(u.hostname) && !u.username && !u.password
  } catch {
    return false
  }
}

function paging(url, defaultSize = 20) {
  const num = (name, fallback) => {
    const n = Number.parseInt(url.searchParams.get(name) ?? '', 10)
    return Number.isNaN(n) ? fallback : n
  }
  return {
    page: Math.max(num('page', 1), 1),
    pageSize: Math.min(Math.max(num('pageSize', defaultSize), 1), MAX_PAGE_SIZE),
  }
}
const paged = (all, { page, pageSize }) => ({
  items: all.slice((page - 1) * pageSize, page * pageSize),
  page,
  pageSize,
  total: all.length,
})

// ---------------------------------------------------------------------------------------------
// Menu public, panier, restaurant
// ---------------------------------------------------------------------------------------------
function cartResponse(userId, lang) {
  const cart = db.carts.get(userId) ?? new Map()
  const lignes = [...cart.entries()].map(([articleId, quantite]) => {
    const a = findArticle(articleId)
    const disponible = isOrderable(a)
    return {
      articleId,
      nom: pick(a.nomFr, a.nomAr, lang),
      prixUnitaire: a.prix,
      imageUrl: a.imageUrl,
      disponible,
      quantite,
      totalLigne: round2(a.prix * quantite),
      avertissement: disponible ? null : 'indisponible',
    }
  })
  return {
    lignes,
    nombreArticles: lignes.reduce((n, l) => n + l.quantite, 0),
    sousTotal: round2(lignes.reduce((n, l) => n + l.totalLigne, 0)),
    dateMiseAJour: lignes.length ? toIso(Date.now()) : null,
  }
}

function menuFor(lang) {
  return categories
    .filter((c) => c.estActive)
    .sort(byOrdre)
    .map((category) => ({
      id: category.id,
      nom: pick(category.nomFr, category.nomAr, lang),
      ordre: category.ordre,
      articles: articles
        .filter((a) => a.categorieId === category.id && a.estActif)
        .sort(byOrdre)
        .map((a) => ({
          id: a.id,
          categorieId: category.id,
          nom: pick(a.nomFr, a.nomAr, lang),
          description: pick(a.descriptionFr, a.descriptionAr, lang),
          prix: a.prix,
          imageUrl: a.imageUrl,
          estPopulaire: a.estPopulaire,
          disponible: a.estDisponible,
          ordre: a.ordre,
        })),
    }))
}

/** Heure de Tunis : calcule ouvertMaintenant comme le vrai back-end (fermeture après minuit incluse). */
function isOpenNow(horaires, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Tunis',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const get = (type) => parts.find((p) => p.type === type)?.value ?? ''
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  const time = `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`
  const slot = (d) => horaires.find((h) => h.jourSemaine === d)
  const today = slot(day)
  if (today && !today.estFerme) {
    const overnight = today.fermeture < today.ouverture
    if (time >= today.ouverture && (overnight || time < today.fermeture)) return true
  }
  // Créneau de la veille qui déborde après minuit.
  const yesterday = slot((day + 6) % 7)
  return Boolean(
    yesterday &&
    !yesterday.estFerme &&
    yesterday.fermeture < yesterday.ouverture &&
    time < yesterday.fermeture,
  )
}

const openNow = () =>
  !db.settings.forceClosed && (db.settings.alwaysOpen || isOpenNow(restaurant.horaires))

/** RestaurantResponse : renvoyé par GET public et par les 3 routes admin. */
const restaurantResponse = () => ({
  nom: restaurant.nom,
  telephone: restaurant.telephone,
  email: restaurant.email,
  adresse: restaurant.adresse,
  fraisLivraison: restaurant.fraisLivraison,
  montantMinimumLivraison: restaurant.montantMinimumLivraison,
  commandesOuvertes: db.settings.commandesOuvertes,
  horaires: restaurant.horaires,
  ouvertMaintenant: openNow(),
})

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function authenticate(req) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const session = token ? db.sessions.get(token) : null
  if (!session || session.expires < Date.now()) return null
  const user = db.users.find((u) => u.id === session.userId) ?? null
  // Compte désactivé : les jetons existants sont refusés (401), comme dans le vrai back-end.
  return user?.estActif ? user : null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/
const qtyError = () =>
  fieldError('Quantite', `La quantité doit être comprise entre 1 et ${MAX_QTY}.`)

// ---------------------------------------------------------------------------------------------
// Commandes : modèle interne, projection client, projections admin
// ---------------------------------------------------------------------------------------------

/** Enregistre un changement (statut, paiement, annulation) : version, dateMiseAJour, historique. */
function touch(order, actor, statut) {
  const date = toIso(Date.now())
  order.version += 1
  order.dateMiseAJour = date
  if (statut) {
    order.historique.push({
      statut,
      date,
      parUserId: actor?.id ?? null,
      parNom: actor ? nomOf(actor) : null,
    })
  }
}

/** Format client existant : sans nomClient/telephone/version/dateMiseAJour/parUser*. */
const clientOrder = (o) => ({
  id: o.id,
  numero: o.numero,
  statut: o.statut,
  typeCommande: o.typeCommande,
  modePaiement: o.modePaiement,
  estPayee: o.estPayee,
  sousTotal: o.sousTotal,
  fraisLivraison: o.fraisLivraison,
  total: o.total,
  note: o.note,
  adresseLivraison: o.adresseLivraison,
  tableNumero: o.tableNumero,
  dateCommande: o.dateCommande,
  lignes: o.lignes,
  historique: o.historique.map((h) => ({ statut: h.statut, date: h.date })),
})

const orderResume = (o) => ({
  id: o.id,
  numero: o.numero,
  statut: o.statut,
  typeCommande: o.typeCommande,
  total: o.total,
  nombreArticles: o.lignes.reduce((n, l) => n + l.quantite, 0),
  dateCommande: o.dateCommande,
})

const adminResume = (o) => ({
  id: o.id,
  numero: o.numero,
  statut: o.statut,
  typeCommande: o.typeCommande,
  nomClient: o.nomClient,
  telephone: o.telephone,
  tableNumero: o.tableNumero,
  total: o.total,
  estPayee: o.estPayee,
  nombreArticles: o.lignes.reduce((n, l) => n + l.quantite, 0),
  dateCommande: o.dateCommande,
  dateMiseAJour: o.dateMiseAJour,
})

const adminOrder = (o) => ({
  id: o.id,
  numero: o.numero,
  statut: o.statut,
  statutsSuivants: NEXT_STATUTS[o.statut],
  typeCommande: o.typeCommande,
  modePaiement: o.modePaiement,
  estPayee: o.estPayee,
  sousTotal: o.sousTotal,
  fraisLivraison: o.fraisLivraison,
  total: o.total,
  note: o.note,
  adresseLivraison: o.adresseLivraison,
  tableNumero: o.tableNumero,
  client: { userId: o.userId, nom: o.nomClient, telephone: o.telephone },
  dateCommande: o.dateCommande,
  dateMiseAJour: o.dateMiseAJour,
  lignes: o.lignes,
  historique: o.historique,
  version: o.version,
})

const activeOrder = (o) => ({
  id: o.id,
  numero: o.numero,
  statut: o.statut,
  typeCommande: o.typeCommande,
  nomClient: o.nomClient,
  tableNumero: o.tableNumero,
  note: o.note,
  dateCommande: o.dateCommande,
  dateMiseAJour: o.dateMiseAJour,
  lignes: o.lignes.map((l) => ({ nomFr: l.nomFr, nomAr: l.nomAr, quantite: l.quantite })),
  version: o.version,
})

/** Construit et enregistre une commande EnAttente (cart : tableau de [articleId, quantite]). */
function buildOrder({
  user,
  nomClient,
  telephone,
  type,
  tableNumero,
  tableId,
  adresse,
  note,
  cart,
  dateMs,
}) {
  const lignes = cart.map(([id, quantite]) => {
    const a = findArticle(id)
    return {
      articleId: id,
      nomFr: a.nomFr,
      nomAr: a.nomAr,
      prixUnitaire: a.prix,
      quantite,
      totalLigne: round2(a.prix * quantite),
    }
  })
  const sousTotal = round2(lignes.reduce((n, l) => n + l.totalLigne, 0))
  const frais = type === 'Livraison' ? round2(restaurant.fraisLivraison) : 0
  const id = db.nextOrderId++
  const now = toIso(dateMs)
  const order = {
    id,
    userId: user.id,
    nomClient,
    telephone,
    numero: `CMD-${String(id).padStart(6, '0')}`,
    statut: 'EnAttente',
    typeCommande: type,
    modePaiement: 'Especes',
    estPayee: false,
    sousTotal,
    fraisLivraison: frais,
    total: round2(sousTotal + frais),
    note: note?.trim() || null,
    adresseLivraison: adresse,
    tableNumero,
    // Lien vers la table (plan de salle) ; le numéro ci-dessus reste une copie figée.
    tableId: tableId ?? db.tables.find((t) => t.numero === tableNumero)?.id ?? null,
    dateCommande: now,
    dateMiseAJour: now,
    version: 1,
    lignes,
    historique: [{ statut: 'EnAttente', date: now, parUserId: user.id, parNom: nomOf(user) }],
  }
  db.orders.push(order)
  return order
}

async function createOrder(u, b) {
  const type = b.typeCommande
  if (!TYPES.includes(type)) throw fieldError('TypeCommande', 'Le type de commande est invalide.')
  if (!b.telephone || !PHONE_RE.test(b.telephone))
    throw fieldError('Telephone', "Le numéro de téléphone n'est pas valide.")
  const adresse = b.adresseLivraison?.trim() || null
  if (type === 'Livraison') {
    if (!adresse || adresse.length < 10 || adresse.length > 500)
      throw fieldError(
        'AdresseLivraison',
        "L'adresse de livraison est obligatoire (10 à 500 caractères).",
      )
    if (b.tableCode)
      throw fieldError(
        'TableCode',
        "Le code de table n'est accepté que pour une commande sur place.",
      )
  } else if (adresse) {
    throw fieldError(
      'AdresseLivraison',
      "L'adresse de livraison n'est acceptée que pour une livraison.",
    )
  }
  if (type === 'SurPlace' && !b.tableCode)
    throw fieldError(
      'TableCode',
      'Le code de la table est obligatoire pour une commande sur place.',
    )
  if (type === 'ARemporter' && b.tableCode)
    throw fieldError('TableCode', "Le code de table n'est accepté que pour une commande sur place.")

  if (!db.settings.commandesOuvertes)
    throw problem(409, 'La prise de commandes est fermée pour le moment.')
  if (!openNow()) throw problem(409, 'Le restaurant est actuellement fermé.')

  let tableNumero = null
  let tableId = null
  if (type === 'SurPlace') {
    const found = findActiveTableByCode(b.tableCode)
    tableNumero = found?.numero ?? null
    tableId = found?.id ?? null
    if (!tableNumero) throw fieldError('TableCode', 'Table inconnue ou inactive.')
  }

  const cart = db.carts.get(u.id)
  if (!cart || cart.size === 0) throw fieldError('Panier', 'Votre panier est vide.')
  const blocked = [...cart.keys()].map(findArticle).filter((a) => !isOrderable(a))
  if (blocked.length)
    throw problem(
      409,
      `Ces articles ne sont plus disponibles : ${blocked.map((a) => a.nomFr).join(', ')}. Retirez-les de votre panier.`,
    )

  const sousTotal = round2(
    [...cart.entries()].reduce((n, [id, q]) => n + round2(findArticle(id).prix * q), 0),
  )
  if (type === 'Livraison' && sousTotal < restaurant.montantMinimumLivraison)
    throw fieldError(
      'Panier',
      `Le montant minimum pour une livraison est de ${restaurant.montantMinimumLivraison.toFixed(2)} DT (sous-total actuel : ${sousTotal.toFixed(2)} DT).`,
    )

  const order = buildOrder({
    user: u,
    nomClient: nomOf(u),
    telephone: b.telephone,
    type,
    tableNumero,
    tableId,
    adresse,
    note: b.note,
    cart: [...cart.entries()],
    dateMs: Date.now(),
  })
  db.carts.delete(u.id)
  return order
}

// --- Admin commandes : analyse des filtres (toute saisie invalide donne un 400) ---

/** Noms d'énumération uniquement (insensible à la casse) ; renvoie la forme canonique. */
function parseEnum(value, field, names) {
  const text = String(value).trim()
  const found = /^\p{L}{1,30}$/u.test(text)
    ? names.find((n) => n.toLowerCase() === text.toLowerCase())
    : undefined
  if (!found) throw fieldError(field, `Valeur invalide. Valeurs possibles : ${names.join(', ')}.`)
  return found
}

/** « AAAA-MM-JJ » (jour UTC entier) ou date-heure ISO 8601 (UTC si sans fuseau). */
function parseBound(value, field) {
  const text = (value ?? '').trim()
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const ms = Date.parse(`${text}T00:00:00Z`)
    if (!Number.isNaN(ms) && toIso(ms).startsWith(text)) return { ms, dateOnly: true }
  } else if (text.length <= 40 && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text)) {
    const ms = Date.parse(/(Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`)
    if (!Number.isNaN(ms)) return { ms, dateOnly: false }
  }
  throw fieldError(field, 'Date invalide : utilisez AAAA-MM-JJ ou une date-heure ISO 8601 (UTC).')
}

function listAdminOrders(url) {
  const q = url.searchParams
  const { page, pageSize } = paging(url)
  const statuts = [
    ...new Set(
      q
        .getAll('statut')
        .flatMap((raw) =>
          raw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        )
        .map((s) => parseEnum(s, 'statut', STATUTS)),
    ),
  ]
  const type = q.get('typeCommande')?.trim()
    ? parseEnum(q.get('typeCommande'), 'typeCommande', TYPES)
    : null
  const rawPaid = q.get('estPayee')?.trim().toLowerCase()
  if (rawPaid && rawPaid !== 'true' && rawPaid !== 'false')
    throw fieldError('estPayee', "La valeur n'est pas valide.")
  const from = parseBound(q.get('du'), 'du')
  const to = parseBound(q.get('au'), 'au')
  if (from && to && from.ms > to.ms)
    throw fieldError('du', 'La date de début doit précéder la date de fin.')
  const term = q.get('recherche')?.trim().toLowerCase()
  if (term && term.length > 100)
    throw fieldError('recherche', 'La recherche ne peut pas dépasser 100 caractères.')

  const rows = db.orders
    .filter((o) => {
      const d = Date.parse(o.dateCommande)
      return (
        (!statuts.length || statuts.includes(o.statut)) &&
        (!type || o.typeCommande === type) &&
        (!rawPaid || o.estPayee === (rawPaid === 'true')) &&
        (!from || d >= from.ms) &&
        (!to || (to.dateOnly ? d < to.ms + 86_400_000 : d <= to.ms)) &&
        (!term ||
          o.numero.toLowerCase().includes(term) ||
          o.nomClient.toLowerCase().includes(term) ||
          o.telephone.toLowerCase().includes(term))
      )
    })
    .sort((a, b) => Date.parse(b.dateCommande) - Date.parse(a.dateCommande) || b.id - a.id)
  const result = paged(rows, { page, pageSize })
  return { ...result, items: result.items.map(adminResume) }
}

/** Compteurs du jour civil Africa/Tunis (UTC+1 toute l'année, pas d'heure d'été). */
function compteurs() {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date())
  const start = Date.parse(`${date}T00:00:00+01:00`)
  const today = db.orders.filter((o) => {
    const d = Date.parse(o.dateCommande)
    return d >= start && d < start + 86_400_000
  })
  const parStatut = STATUTS.map((statut) => ({
    statut,
    nombre: today.filter((o) => o.statut === statut).length,
  }))
  return {
    date,
    parStatut,
    totalAujourdhui: today.length,
    enAttente: db.orders.filter((o) => o.statut === 'EnAttente').length,
  }
}

function findOrder(id) {
  const order = db.orders.find((o) => o.id === Number(id))
  if (!order) throw problem(404, 'Commande introuvable.')
  return order
}

function changerStatut(admin, order, body) {
  if (typeof body.statut !== 'string' || !body.statut.trim())
    throw fieldError('Statut', 'Le champ Statut est requis.')
  const cible = parseEnum(body.statut, 'Statut', STATUTS)
  // Idempotence : statut déjà atteint → 200, sans doublon d'historique (avant le contrôle de version).
  if (order.statut === cible) return adminOrder(order)
  if (body.version != null && body.version !== order.version)
    throw problem(409, 'La commande a été modifiée entre-temps. Rechargez-la et réessayez.')
  if (!NEXT_STATUTS[order.statut].includes(cible))
    throw problem(409, `${order.statut} -> ${cible} n'est pas autorisé.`)
  order.statut = cible
  touch(order, admin, cible)
  return adminOrder(order)
}

// --- Seed / commandes entrantes de démonstration (hors vrai back-end) ---

const SEED_TYPES = ['SurPlace', 'Livraison', 'ARemporter', 'SurPlace']
const SEED_CLIENTS = [
  ['Amine Ben Salah', '+21622334455'],
  ['Salma Trabelsi', '+21698112233'],
  ['Mohamed Gharbi', '+21650778899'],
  ['Ines Jebali', '+21627445566'],
  ['Karim Mansouri', '+21655990011'],
  ['Rim Chaabane', '+21629667788'],
  ['Walid Hamdi', '+21694223344'],
  ['Nour Bouazizi', '+21653110022'],
]
const SEED_NOTES = ['Sans piment, merci.', 'Bien cuit svp.', 'Sonnez à l’interphone.']

/** 1 à 3 articles distincts, commandables, choisis de façon déterministe. */
function sampleCart(seed) {
  const pool = articles.filter(isOrderable).sort(byOrdre)
  const size = 1 + (seed % 3)
  const ids = new Set()
  for (let k = 0; k < size && pool.length; k++) ids.add(pool[(seed * 5 + k * 7) % pool.length].id)
  return [...ids].map((id, k) => [id, 1 + ((seed + k) % 3)])
}

function seedOrders(count) {
  const client = db.users.find((u) => u.id === 'u-client')
  const admin = db.users.find((u) => u.id === 'u-admin')
  const now = Date.now()
  const ids = []
  for (let i = 0; i < count; i++) {
    // i = 0 : la plus ancienne, donc la plus avancée ; la dernière est EnAttente.
    const finalIdx = (count - 1 - i) % STATUS_FLOW.length
    const ageMin = (count - i) * 17 + (i % 3) * 5
    const type = SEED_TYPES[i % SEED_TYPES.length]
    const [nomClient, telephone] = SEED_CLIENTS[i % SEED_CLIENTS.length]
    const order = buildOrder({
      user: client,
      nomClient,
      telephone,
      type,
      tableNumero: type === 'SurPlace' ? (i % 2 === 0 ? 1 : 5) : null,
      adresse: type === 'Livraison' ? '24 rue de Marseille, 1002 Tunis' : null,
      note: i % 2 === 1 ? SEED_NOTES[(i >> 1) % SEED_NOTES.length] : null,
      cart: sampleCart(i + db.orders.length),
      dateMs: now - ageMin * 60_000,
    })
    // Rejoue l'historique jusqu'au statut final, étalé entre la création et maintenant.
    for (let s = 1; s <= finalIdx; s++) {
      const at = toIso(Date.parse(order.dateCommande) + s * 4 * 60_000)
      order.statut = STATUS_FLOW[s]
      order.historique.push({
        statut: order.statut,
        date: at,
        parUserId: admin.id,
        parNom: nomOf(admin),
      })
      order.version += 1
      order.dateMiseAJour = at
    }
    if (finalIdx >= 3) order.estPayee = true
    ids.push(order.id)
  }
  return ids
}

/** POST /__mock/salle/seed : commandes SurPlace de démo (appels répétés = doublons, non idempotent). */
function seedSalle() {
  const client = db.users.find((u) => u.id === 'u-client')
  const admin = db.users.find((u) => u.id === 'u-admin')
  const now = Date.now()
  // [numéro de table, statut, estPayee, âge en minutes, index client]
  const plan = [
    [1, 'EnPreparation', false, 40, 0],
    [1, 'Prete', true, 75, 1],
    [5, 'Terminee', false, 60, 2],
    [5, 'Terminee', false, 25, 3],
    [3, 'EnAttente', false, 8, 4],
  ]
  const ids = []
  plan.forEach(([numero, statut, estPayee, ageMin, c], i) => {
    const t = db.tables.find((x) => x.numero === numero)
    if (!t) return
    const [nomClient, telephone] = SEED_CLIENTS[c]
    const order = buildOrder({
      user: client,
      nomClient,
      telephone,
      type: 'SurPlace',
      tableNumero: t.numero,
      tableId: t.id,
      adresse: null,
      note: null,
      cart: sampleCart(i + db.orders.length),
      dateMs: now - ageMin * 60_000,
    })
    for (let s = 1; s <= STATUS_FLOW.indexOf(statut); s++) {
      const at = toIso(Date.parse(order.dateCommande) + s * 3 * 60_000)
      order.statut = STATUS_FLOW[s]
      order.historique.push({
        statut: order.statut,
        date: at,
        parUserId: admin.id,
        parNom: nomOf(admin),
      })
      order.version += 1
      order.dateMiseAJour = at
    }
    order.estPayee = estPayee
    ids.push(order.id)
  })
  return ids
}

// ---------------------------------------------------------------------------------------------
// Admin : plan de salle (état déduit des commandes SurPlace, jamais stocké)
// ---------------------------------------------------------------------------------------------
const isTracked = (o) => o.statut !== 'Annulee' && !(o.statut === 'Terminee' && o.estPayee)
const isInProgress = (o) => ACTIVE_STATUTS.includes(o.statut)
const tableOrders = (t) =>
  db.orders
    .filter((o) => o.typeCommande === 'SurPlace' && o.tableId === t.id && isTracked(o))
    .sort((a, b) => Date.parse(a.dateCommande) - Date.parse(b.dateCommande) || a.id - b.id)

function salleEntry(t) {
  const list = tableOrders(t)
  const unpaid = list.filter((o) => !o.estPayee)
  const etat = !t.estActive
    ? 'Inactive'
    : list.some(isInProgress)
      ? 'Occupee'
      : unpaid.length
        ? 'AEncaisser'
        : 'Libre'
  return {
    id: t.id,
    numero: t.numero,
    capacite: t.capacite,
    estActive: t.estActive,
    etat,
    totalAEncaisser: round2(unpaid.reduce((n, o) => n + o.total, 0)),
    nombreCommandes: list.length,
    premiereCommandeUtc: list[0]?.dateCommande ?? null,
    commandes: list.map((o) => ({
      id: o.id,
      numero: o.numero,
      statut: o.statut,
      total: o.total,
      estPayee: o.estPayee,
      dateCommande: o.dateCommande,
    })),
  }
}

function encaisserTable(t) {
  const unpaid = db.orders.filter(
    (o) =>
      o.typeCommande === 'SurPlace' && o.tableId === t.id && o.statut !== 'Annulee' && !o.estPayee,
  )
  if (!unpaid.length) throw problem(409, `La table n° ${t.numero} n'a rien à encaisser.`)
  for (const o of unpaid) {
    o.estPayee = true
    touch(o, null, null)
  }
}

function libererTable(t, admin) {
  const list = tableOrders(t)
  const enCours = list.filter(
    (o) => o.statut === 'EnAttente' || o.statut === 'EnPreparation',
  ).length
  const nonPayees = list.filter((o) => !o.estPayee).length
  if (enCours || nonPayees) {
    const reasons = []
    if (enCours)
      reasons.push(
        `${enCours} commande(s) en attente ou en préparation (terminez-les ou annulez-les d'abord)`,
      )
    if (nonPayees) reasons.push(`${nonPayees} commande(s) non encaissée(s) (encaissez d'abord)`)
    throw problem(409, `Impossible de libérer la table n° ${t.numero} : ${reasons.join(' ; ')}.`)
  }
  for (const o of list.filter((x) => x.statut === 'Prete')) {
    o.statut = 'Terminee'
    touch(o, admin, 'Terminee')
  }
}

// ---------------------------------------------------------------------------------------------
// Statistiques admin (jours/heures civils Africa/Tunis = UTC+1 fixe ; commandes en direct + historique fictif)
// ---------------------------------------------------------------------------------------------
const STATS_DEFAULT_DAYS = 30
const STATS_MAX_DAYS = 366
const STATS_MAX_TOP = 20
const TUNIS_SHIFT_MS = 3_600_000
const dayNumber = (iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000)
const addDays = (iso, n) => new Date((dayNumber(iso) + n) * 86_400_000).toISOString().slice(0, 10)
const localDay = (iso) => tunisDay(Date.parse(iso))
const localHour = (iso) => new Date(Date.parse(iso) + TUNIS_SHIFT_MS).getUTCHours()
const lineAmount = (l) => round2(l.prixUnitaire * l.quantite)
const sumMoney = (values) => round2(values.reduce((n, v) => n + v, 0))
const isSale = (o) => o.statut !== 'Annulee'
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

function parseStatsDay(value, field) {
  if (value == null || !String(value).trim()) return null
  const text = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const t = Date.parse(`${text}T00:00:00Z`)
    if (Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === text) return text
  }
  throw fieldError(field, 'Date invalide : utilisez le format AAAA-MM-JJ.')
}

/** { du, au, days } : défaut 30 derniers jours (aujourd'hui compris), 366 jours au plus. */
function statsPeriod(url) {
  const from = parseStatsDay(url.searchParams.get('du'), 'du')
  const to = parseStatsDay(url.searchParams.get('au'), 'au')
  const au = to ?? tunisDay(Date.now())
  const du = from ?? addDays(au, 1 - STATS_DEFAULT_DAYS)
  if (du > au) throw fieldError('du', 'La date de début doit précéder la date de fin.')
  const days = dayNumber(au) - dayNumber(du) + 1
  if (days > STATS_MAX_DAYS)
    throw fieldError('au', `La période ne peut pas dépasser ${STATS_MAX_DAYS} jours.`)
  return { du, au, days }
}

const inPeriod = (iso, p) => {
  const d = localDay(iso)
  return d >= p.du && d <= p.au
}
const statsOrders = (p) => [...db.history, ...db.orders].filter((o) => inPeriod(o.dateCommande, p))
const orderRevenue = (o) => sumMoney(o.lignes.map(lineAmount))

function periodValues(p) {
  const orders = statsOrders(p)
  const sales = orders.filter(isSale)
  const ca = sumMoney(sales.map(orderRevenue))
  const clients = [...db.users.filter((u) => u.roles.includes('Client')), ...db.historyClients]
  return {
    chiffreAffaires: ca,
    nombreCommandes: sales.length,
    panierMoyen: sales.length ? round2(ca / sales.length) : 0,
    nombreAnnulees: orders.length - sales.length,
    montantAEncaisser: sumMoney(sales.filter((o) => !o.estPayee).map((o) => o.total)),
    nouveauxClients: clients.filter((u) => u.dateCreation && inPeriod(u.dateCreation, p)).length,
  }
}

const variation = (cur, prev) => (prev === 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10)

function statsResume(p) {
  const prev = { du: addDays(p.du, -p.days), au: addDays(p.du, -1), days: p.days }
  const periode = periodValues(p)
  const precedente = periodValues(prev)
  return {
    du: p.du,
    au: p.au,
    periode,
    precedenteDu: prev.du,
    precedenteAu: prev.au,
    precedente,
    variation: Object.fromEntries(
      Object.keys(periode).map((k) => [k, variation(periode[k], precedente[k])]),
    ),
  }
}

function statsVentesParJour(p) {
  const rows = new Map(
    Array.from({ length: p.days }, (_, i) => [addDays(p.du, i), { ca: 0, n: 0 }]),
  )
  for (const o of statsOrders(p).filter(isSale)) {
    const r = rows.get(localDay(o.dateCommande))
    r.ca += orderRevenue(o)
    r.n++
  }
  return [...rows].map(([date, r]) => ({ date, chiffreAffaires: round2(r.ca), commandes: r.n }))
}

function statsTopArticles(p, limite, lang) {
  const groups = new Map()
  const sales = statsOrders(p).filter(isSale)
  for (const o of sales.sort((a, b) => cmpStr(a.dateCommande, b.dateCommande))) {
    for (const l of o.lignes) {
      const key = l.articleId != null ? `a:${l.articleId}` : `n:${l.nomFr}`
      const g = groups.get(key) ?? { articleId: l.articleId ?? null, quantite: 0, ca: 0 }
      g.nom = pick(l.nomFr, l.nomAr, lang) // la ligne la plus récente donne le nom
      g.quantite += l.quantite
      g.ca += lineAmount(l)
      groups.set(key, g)
    }
  }
  const n = Math.min(Math.max(Number.isFinite(limite) ? limite : 10, 1), STATS_MAX_TOP)
  return [...groups.values()]
    .map((g) => ({
      articleId: g.articleId,
      nom: g.nom,
      quantite: g.quantite,
      chiffreAffaires: round2(g.ca),
    }))
    .sort(
      (a, b) =>
        b.quantite - a.quantite || b.chiffreAffaires - a.chiffreAffaires || cmpStr(a.nom, b.nom),
    )
    .slice(0, n)
}

function statsHeures(p) {
  const rows = Array.from({ length: 24 }, (_, heure) => ({ heure, commandes: 0, ca: 0 }))
  for (const o of statsOrders(p).filter(isSale)) {
    const r = rows[localHour(o.dateCommande)]
    r.commandes++
    r.ca += orderRevenue(o)
  }
  return rows.map((r) => ({
    heure: r.heure,
    commandes: r.commandes,
    chiffreAffaires: round2(r.ca),
  }))
}

function statsRepartition(p, lang) {
  const orders = statsOrders(p)
  const sales = orders.filter(isSale)
  const parType = TYPES.map((t) => {
    const list = sales.filter((o) => o.typeCommande === t)
    return { type: t, commandes: list.length, chiffreAffaires: sumMoney(list.map(orderRevenue)) }
  })
  const parStatut = STATUTS.map((s) => {
    const list = orders.filter((o) => o.statut === s)
    return {
      statut: s,
      commandes: list.length,
      chiffreAffaires: s === 'Annulee' ? 0 : sumMoney(list.map(orderRevenue)),
    }
  })
  const cats = new Map()
  for (const o of sales) {
    for (const l of o.lignes) {
      const a = l.articleId != null ? findArticle(l.articleId) : null
      const c = a ? findCategorie(a.categorieId) : null
      const key = c ? c.id : null
      const g = cats.get(key) ?? {
        categorieId: key,
        nom: c ? pick(c.nomFr, c.nomAr, lang) : lang === 'ar' ? 'أخرى' : 'Autres',
        quantite: 0,
        ca: 0,
      }
      g.quantite += l.quantite
      g.ca += lineAmount(l)
      cats.set(key, g)
    }
  }
  const parCategorie = [...cats.values()]
    .map((g) => ({
      categorieId: g.categorieId,
      nom: g.nom,
      quantite: g.quantite,
      chiffreAffaires: round2(g.ca),
    }))
    .sort(
      (a, b) =>
        (a.categorieId === null) - (b.categorieId === null) ||
        b.chiffreAffaires - a.chiffreAffaires ||
        cmpStr(a.nom, b.nom),
    )
  return { parType, parStatut, parCategorie }
}

// ---------------------------------------------------------------------------------------------
// Admin : catégories et articles
// ---------------------------------------------------------------------------------------------
const categorieAdmin = (c) => ({
  id: c.id,
  nomFr: c.nomFr,
  nomAr: c.nomAr,
  ordre: c.ordre,
  estActive: c.estActive,
  nombreArticlesActifs: articles.filter((a) => a.categorieId === c.id && a.estActif).length,
})
const listCategoriesAdmin = () => [...categories].sort(byOrdre).map(categorieAdmin)

function findCategorieOr404(id) {
  const c = findCategorie(Number(id))
  if (!c) throw problem(404, 'Catégorie introuvable.')
  return c
}

/** CategorieRequest : nomFr/nomAr requis ≤100, ordre 0..10000 facultatif. */
function validateCategorie(b) {
  const errors = {}
  checkRequiredString(errors, 'NomFr', b.nomFr, 100)
  checkRequiredString(errors, 'NomAr', b.nomAr, 100)
  if (b.ordre != null && !(Number.isInteger(b.ordre) && b.ordre >= 0 && b.ordre <= 10000))
    addError(errors, 'Ordre', 'La valeur doit être comprise entre 0 et 10000.')
  throwIfInvalid(errors)
}

function ensureCategorieNameFree(nomFr, exceptId) {
  const lowered = nomFr.toLowerCase()
  if (categories.some((c) => c.id !== exceptId && c.nomFr.toLowerCase() === lowered))
    throw problem(409, `Une catégorie nommée « ${nomFr} » existe déjà.`)
}

/** ReorderRequest : Ids requis (≥ 1 élément), sans doublon. */
function readIds(b) {
  if (!Array.isArray(b.ids) || b.ids.length < 1 || !b.ids.every(Number.isInteger))
    throw fieldError('Ids', "La liste d'identifiants est requise.")
  if (new Set(b.ids).size !== b.ids.length)
    throw fieldError('Ids', 'La liste contient des identifiants en double.')
  return b.ids
}

const renumber = (list) => list.forEach((item, i) => (item.ordre = i + 1))

const articleAdmin = (a) => ({
  id: a.id,
  categorieId: a.categorieId,
  nomFr: a.nomFr,
  nomAr: a.nomAr,
  descriptionFr: a.descriptionFr,
  descriptionAr: a.descriptionAr,
  prix: a.prix,
  imageUrl: a.imageUrl,
  estDisponible: a.estDisponible,
  estActif: a.estActif,
  estPopulaire: a.estPopulaire,
  ordre: a.ordre,
  dateCreation: a.dateCreation,
  dateMiseAJour: a.dateMiseAJour,
})

function findArticleOr404(id) {
  const a = findArticle(Number(id))
  if (!a) throw problem(404, 'Article introuvable.')
  return a
}

const catOrdre = (a) => findCategorie(a.categorieId)?.ordre ?? 0
const articleSort = (a, b) => catOrdre(a) - catOrdre(b) || a.ordre - b.ordre || a.id - b.id

/** ArticleRequest : validation du modèle (tous les champs), puis existence de la catégorie. */
function validateArticle(b) {
  const errors = {}
  if (!Number.isInteger(b.categorieId) || b.categorieId < 1)
    addError(errors, 'CategorieId', 'La valeur doit être supérieure ou égale à 1.')
  checkRequiredString(errors, 'NomFr', b.nomFr, 150)
  checkRequiredString(errors, 'NomAr', b.nomAr, 150)
  checkMoney(errors, 'Prix', b.prix)
  checkOptionalString(errors, 'DescriptionFr', b.descriptionFr, 1000)
  checkOptionalString(errors, 'DescriptionAr', b.descriptionAr, 1000)
  if (b.imageUrl != null && !isValidImageUrl(b.imageUrl))
    addError(
      errors,
      'ImageUrl',
      'ImageUrl doit être un chemin relatif commençant par /images/ ou une URL https.',
    )
  if (b.ordre != null && !(Number.isInteger(b.ordre) && b.ordre >= 0 && b.ordre <= 10000))
    addError(errors, 'Ordre', 'La valeur doit être comprise entre 0 et 10000.')
  throwIfInvalid(errors)
  if (!findCategorie(b.categorieId))
    throw fieldError('CategorieId', "Cette catégorie n'existe pas.")
}

const blankToNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)

function applyArticle(a, b, now) {
  a.categorieId = b.categorieId
  a.nomFr = b.nomFr.trim()
  a.nomAr = b.nomAr.trim()
  a.descriptionFr = blankToNull(b.descriptionFr)
  a.descriptionAr = blankToNull(b.descriptionAr)
  a.prix = b.prix
  a.imageUrl = b.imageUrl ?? null
  a.estDisponible = b.estDisponible ?? true
  a.estPopulaire = b.estPopulaire ?? false
  a.dateMiseAJour = now
}

const requireBool = (b, key, field) => {
  if (typeof b[key] !== 'boolean') throw fieldError(field, 'Le champ est requis (booléen).')
  return b[key]
}

// ---------------------------------------------------------------------------------------------
// Admin : restaurant
// ---------------------------------------------------------------------------------------------
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function updateRestaurant(b) {
  const errors = {}
  checkRequiredString(errors, 'Nom', b.nom, 100)
  checkRequiredString(errors, 'Telephone', b.telephone, 20)
  if (typeof b.telephone === 'string' && b.telephone.trim() && !PHONE_RE.test(b.telephone))
    addError(errors, 'Telephone', "Le numéro de téléphone n'est pas valide.")
  checkRequiredString(errors, 'Email', b.email, 150)
  if (typeof b.email === 'string' && b.email.trim() && !EMAIL_RE.test(b.email))
    addError(errors, 'Email', "L'e-mail n'est pas valide.")
  checkRequiredString(errors, 'Adresse', b.adresse, 300)
  checkMoney(errors, 'FraisLivraison', b.fraisLivraison)
  checkMoney(errors, 'MontantMinimumLivraison', b.montantMinimumLivraison)
  throwIfInvalid(errors)
  Object.assign(restaurant, {
    nom: b.nom.trim(),
    telephone: b.telephone.trim(),
    email: b.email.trim(),
    adresse: b.adresse.trim(),
    fraisLivraison: b.fraisLivraison,
    montantMinimumLivraison: b.montantMinimumLivraison,
  })
}

function updateHoraires(b) {
  const errors = {}
  if (!Array.isArray(b.horaires)) addError(errors, 'Horaires', 'Le champ Horaires est requis.')
  else
    b.horaires.forEach((h, i) => {
      if (!Number.isInteger(h?.jourSemaine) || h.jourSemaine < 0 || h.jourSemaine > 6)
        addError(errors, `Horaires[${i}].JourSemaine`, 'La valeur doit être comprise entre 0 et 6.')
      for (const [key, field] of [
        ['ouverture', 'Ouverture'],
        ['fermeture', 'Fermeture'],
      ])
        if (h?.[key] != null && !HHMM_RE.test(h[key]))
          addError(errors, `Horaires[${i}].${field}`, 'Format attendu : HH:mm.')
    })
  throwIfInvalid(errors)

  const list = b.horaires
  if (list.length !== 7 || new Set(list.map((h) => h.jourSemaine)).size !== 7)
    throw fieldError('Horaires', 'Il faut exactement un horaire pour chacun des 7 jours (0 à 6).')
  const parsed = list.map((h, i) => {
    if (h.estFerme)
      return { jourSemaine: h.jourSemaine, ouverture: null, fermeture: null, estFerme: true }
    if (!h.ouverture)
      throw fieldError(
        `Horaires[${i}].Ouverture`,
        "L'ouverture est requise (HH:mm) pour un jour non fermé.",
      )
    if (!h.fermeture)
      throw fieldError(
        `Horaires[${i}].Fermeture`,
        'La fermeture est requise (HH:mm) pour un jour non fermé.',
      )
    if (h.ouverture === h.fermeture)
      throw fieldError(`Horaires[${i}].Fermeture`, "La fermeture doit différer de l'ouverture.")
    return {
      jourSemaine: h.jourSemaine,
      ouverture: h.ouverture,
      fermeture: h.fermeture,
      estFerme: false,
    }
  })
  restaurant.horaires = parsed.sort((a, b2) => a.jourSemaine - b2.jourSemaine)
}

// ---------------------------------------------------------------------------------------------
// Admin : tables
// ---------------------------------------------------------------------------------------------
const tableAdmin = (t) => ({
  id: t.id,
  numero: t.numero,
  code: t.code,
  capacite: t.capacite,
  estActive: t.estActive,
})
const byNumero = (a, b) => a.numero - b.numero || a.id - b.id
const findActiveTableByCode = (code) =>
  db.tables.find((t) => t.estActive && t.code.toLowerCase() === String(code).toLowerCase())

function validateTable(numero, capacite) {
  if (!Number.isInteger(numero) || numero < 1 || numero > NUMERO_MAX)
    throw fieldError('Numero', `Le numéro de table doit être compris entre 1 et ${NUMERO_MAX}.`)
  if (!Number.isInteger(capacite) || capacite < 1 || capacite > CAPACITE_MAX)
    throw fieldError('Capacite', `La capacité doit être comprise entre 1 et ${CAPACITE_MAX}.`)
}

function ensureNumeroFree(numero, exceptId) {
  if (db.tables.some((t) => t.numero === numero && t.id !== exceptId))
    throw problem(409, `La table n° ${numero} existe déjà.`)
}

// ---------------------------------------------------------------------------------------------
// Routage
// ---------------------------------------------------------------------------------------------

/** Retourne { status, body } (body absent = pas de contenu) ; les erreurs sont lancées via problem(). */
async function route(req, url, user) {
  const { pathname: path } = url
  const method = req.method
  const lang = url.searchParams.get('lang') === 'ar' ? 'ar' : 'fr'
  const need = () => {
    if (!user) throw problem(401, 'Authentification requise.')
    return user
  }
  /** 401 sans jeton valide, 403 si l'utilisateur n'a pas le rôle Admin. */
  const needAdmin = () => {
    const u = need()
    if (!u.roles.includes('Admin')) throw problem(403, 'Accès refusé.')
    return u
  }

  // --- Public ---
  if (method === 'GET' && path === '/api/menu') {
    // Simulations : ?fail=1 → 500 ; ?empty=1 → menu vide ; ?delay=800 → latence.
    if (url.searchParams.get('fail')) throw problem(500, 'Erreur simulée')
    if (url.searchParams.get('empty')) return { status: 200, body: [] }
    return { status: 200, body: menuFor(lang) }
  }
  if (method === 'GET' && path === '/api/restaurant')
    return { status: 200, body: restaurantResponse() }
  const table = path.match(/^\/api\/tables\/([^/]+)$/)
  if (method === 'GET' && table) {
    const found = findActiveTableByCode(table[1])
    if (!found) throw problem(404, 'Table introuvable.')
    return { status: 200, body: { numero: found.numero } }
  }

  // --- Auth ---
  if (method === 'POST' && path === '/api/auth/register') {
    const b = await readJson(req)
    if (!b.email || !EMAIL_RE.test(b.email)) throw fieldError('Email', "L'e-mail n'est pas valide.")
    if (!b.password || b.password.length < 8)
      throw fieldError('Password', 'Le mot de passe doit contenir au moins 8 caractères.')
    if (db.users.some((u) => u.email.toLowerCase() === b.email.toLowerCase()))
      throw problem(409, 'Un compte existe déjà avec cet identifiant ou cet e-mail.')
    db.users.push({
      id: `u-${randomUUID()}`,
      userName: b.userName ?? b.email.split('@')[0],
      nom: b.nom ?? null,
      email: b.email,
      telephone: b.telephone ?? null,
      password: b.password,
      roles: ['Client'],
      langueFavorite: b.langueFavorite ?? 'fr',
      estActif: true,
      dateCreation: toIso(Date.now()),
    })
    return { status: 201 }
  }
  if (method === 'POST' && path === '/api/auth/login') {
    const b = await readJson(req)
    const wanted = String(b.identifiant ?? '').toLowerCase()
    const u = db.users.find(
      (x) => x.email.toLowerCase() === wanted || x.userName.toLowerCase() === wanted,
    )
    if (!u || u.password !== b.password) throw problem(401, 'Authentification échouée.')
    // Comme le vrai back-end : mot de passe valide mais compte désactivé → 403.
    if (!u.estActif) throw problem(403, 'Ce compte est désactivé.')
    const token = `mock-${randomUUID()}`
    const expires = Date.now() + TOKEN_TTL_MS
    db.sessions.set(token, { userId: u.id, expires })
    return { status: 200, body: { token, expiresAtUtc: toIso(expires), user: publicUser(u) } }
  }
  if (method === 'GET' && path === '/api/auth/me') return { status: 200, body: publicUser(need()) }
  if (method === 'PUT' && path === '/api/auth/me') {
    const u = need()
    const b = await readJson(req)
    if (!['fr', 'ar'].includes(b.langueFavorite))
      throw fieldError('LangueFavorite', "La langue doit être 'fr' ou 'ar'.")
    u.nom = b.nom ?? null
    u.telephone = b.telephone ?? null
    u.langueFavorite = b.langueFavorite
    return { status: 200, body: publicUser(u) }
  }
  if (method === 'POST' && path === '/api/auth/me/password') {
    const u = need()
    const b = await readJson(req)
    if (u.password !== b.currentPassword)
      throw fieldError('CurrentPassword', 'Mot de passe incorrect.')
    if (!b.newPassword || b.newPassword.length < 8)
      throw fieldError('NewPassword', 'Le mot de passe doit contenir au moins 8 caractères.')
    u.password = b.newPassword
    return { status: 204 }
  }

  // --- Panier ---
  if (path === '/api/panier' && method === 'GET')
    return { status: 200, body: cartResponse(need().id, lang) }
  if (path === '/api/panier' && method === 'DELETE') {
    db.carts.delete(need().id)
    return { status: 200, body: cartResponse(user.id, 'fr') }
  }
  if (path === '/api/panier/items' && method === 'POST') {
    const u = need()
    const b = await readJson(req)
    if (!(b.quantite >= 1 && b.quantite <= MAX_QTY)) throw qtyError()
    const a = findArticle(b.articleId)
    if (!a || !isVisible(a)) throw problem(404, 'Article introuvable.')
    if (!a.estDisponible) throw problem(409, "Cet article n'est pas disponible pour le moment.")
    const cart = db.carts.get(u.id) ?? new Map()
    cart.set(a.id, Math.min((cart.get(a.id) ?? 0) + b.quantite, MAX_QTY))
    db.carts.set(u.id, cart)
    return { status: 200, body: cartResponse(u.id, lang) }
  }
  const item = path.match(/^\/api\/panier\/items\/(\d+)$/)
  if (item && method === 'PUT') {
    const u = need()
    const b = await readJson(req)
    const id = Number(item[1])
    if (!(b.quantite >= 1 && b.quantite <= MAX_QTY)) throw qtyError()
    const a = findArticle(id)
    if (!a) throw problem(404, 'Article introuvable.')
    const cart = db.carts.get(u.id) ?? new Map()
    if ((!cart.has(id) || b.quantite > cart.get(id)) && !isOrderable(a))
      throw problem(409, "Cet article n'est pas disponible pour le moment.")
    cart.set(id, b.quantite)
    db.carts.set(u.id, cart)
    return { status: 200, body: cartResponse(u.id, lang) }
  }
  if (item && method === 'DELETE') {
    const u = need()
    db.carts.get(u.id)?.delete(Number(item[1]))
    return { status: 200, body: cartResponse(u.id, lang) }
  }

  // --- Commandes (client) ---
  if (path === '/api/commandes' && method === 'POST')
    return { status: 201, body: clientOrder(await createOrder(need(), await readJson(req))) }
  if (path === '/api/commandes' && method === 'GET') {
    const u = need()
    const mine = db.orders.filter((o) => o.userId === u.id).sort((a, b) => b.id - a.id)
    const result = paged(mine, paging(url))
    return { status: 200, body: { ...result, items: result.items.map(orderResume) } }
  }
  const one = path.match(/^\/api\/commandes\/(\d+)(\/annuler)?$/)
  if (one) {
    const u = need()
    const order = db.orders.find((o) => o.id === Number(one[1]) && o.userId === u.id)
    if (!order) throw problem(404, 'Commande introuvable.')
    if (method === 'GET' && !one[2]) return { status: 200, body: clientOrder(order) }
    if (method === 'POST' && one[2]) {
      if (order.statut !== 'EnAttente')
        throw problem(409, 'Seule une commande en attente peut être annulée.')
      order.statut = 'Annulee'
      touch(order, u, 'Annulee')
      return { status: 200, body: clientOrder(order) }
    }
  }

  // --- Admin : statistiques ---
  const stats = path.match(/^\/api\/admin\/statistiques\/([a-z-]+)$/)
  if (stats && method === 'GET') {
    needAdmin()
    const p = statsPeriod(url)
    switch (stats[1]) {
      case 'resume':
        return { status: 200, body: statsResume(p) }
      case 'ventes-par-jour':
        return { status: 200, body: statsVentesParJour(p) }
      case 'top-articles':
        return {
          status: 200,
          body: statsTopArticles(p, parseInt(url.searchParams.get('limite') ?? '', 10), lang),
        }
      case 'heures-de-pointe':
        return { status: 200, body: statsHeures(p) }
      case 'repartition':
        return { status: 200, body: statsRepartition(p, lang) }
    }
  }

  // --- Admin : commandes ---
  if (path === '/api/admin/commandes' && method === 'GET') {
    needAdmin()
    return { status: 200, body: listAdminOrders(url) }
  }
  if (path === '/api/admin/commandes/actives' && method === 'GET') {
    needAdmin()
    const rows = db.orders
      .filter((o) => ACTIVE_STATUTS.includes(o.statut))
      .sort((a, b) => Date.parse(a.dateCommande) - Date.parse(b.dateCommande) || a.id - b.id)
      .slice(0, MAX_ACTIVES)
    return { status: 200, body: rows.map(activeOrder) }
  }
  if (path === '/api/admin/commandes/compteurs' && method === 'GET') {
    needAdmin()
    return { status: 200, body: compteurs() }
  }
  const adminOne = path.match(/^\/api\/admin\/commandes\/(\d+)(?:\/(statut|paiement))?$/)
  if (adminOne) {
    const admin = needAdmin()
    if (method === 'GET' && !adminOne[2])
      return { status: 200, body: adminOrder(findOrder(adminOne[1])) }
    if (method === 'PATCH' && adminOne[2] === 'statut') {
      const order = findOrder(adminOne[1])
      return { status: 200, body: changerStatut(admin, order, await readJson(req)) }
    }
    if (method === 'PATCH' && adminOne[2] === 'paiement') {
      const order = findOrder(adminOne[1])
      const estPayee = requireBool(await readJson(req), 'estPayee', 'EstPayee')
      if (order.statut === 'Annulee')
        throw problem(409, "Le paiement d'une commande annulée ne peut pas être modifié.")
      if (order.estPayee !== estPayee) {
        order.estPayee = estPayee
        touch(order, null, null)
      }
      return { status: 200, body: adminOrder(order) }
    }
  }

  // --- Admin : catégories ---
  if (path === '/api/admin/categories' && method === 'GET') {
    needAdmin()
    return { status: 200, body: listCategoriesAdmin() }
  }
  if (path === '/api/admin/categories' && method === 'POST') {
    needAdmin()
    const b = await readJson(req)
    validateCategorie(b)
    const nomFr = b.nomFr.trim()
    ensureCategorieNameFree(nomFr, null)
    const c = {
      id: Math.max(0, ...categories.map((x) => x.id)) + 1,
      nomFr,
      nomAr: b.nomAr.trim(),
      ordre: b.ordre ?? Math.max(0, ...categories.map((x) => x.ordre)) + 1,
      estActive: true,
    }
    categories.push(c)
    return { status: 201, body: categorieAdmin(c) }
  }
  if (path === '/api/admin/categories/ordre' && method === 'PUT') {
    needAdmin()
    const ids = readIds(await readJson(req))
    const unknown = ids.filter((id) => !findCategorie(id))
    if (unknown.length) throw fieldError('Ids', `Catégorie(s) inconnue(s) : ${unknown.join(', ')}.`)
    const rest = [...categories].sort(byOrdre).filter((c) => !ids.includes(c.id))
    renumber([...ids.map(findCategorie), ...rest])
    return { status: 200, body: listCategoriesAdmin() }
  }
  const catOne = path.match(/^\/api\/admin\/categories\/(\d+)(\/active)?$/)
  if (catOne) {
    needAdmin()
    const c = findCategorieOr404(catOne[1])
    if (method === 'GET' && !catOne[2]) return { status: 200, body: categorieAdmin(c) }
    if (method === 'PUT' && !catOne[2]) {
      const b = await readJson(req)
      validateCategorie(b)
      const nomFr = b.nomFr.trim()
      ensureCategorieNameFree(nomFr, c.id)
      Object.assign(c, { nomFr, nomAr: b.nomAr.trim(), ordre: b.ordre ?? c.ordre })
      return { status: 200, body: categorieAdmin(c) }
    }
    if (method === 'PATCH' && catOne[2]) {
      const estActive = requireBool(await readJson(req), 'estActive', 'EstActive')
      if (!estActive) {
        const actifs = articles.filter((a) => a.categorieId === c.id && a.estActif).length
        if (actifs > 0)
          throw problem(
            409,
            `Impossible de désactiver cette catégorie : elle contient ${actifs} article(s) actif(s). Désactivez-les d'abord.`,
          )
      }
      c.estActive = estActive
      return { status: 200, body: categorieAdmin(c) }
    }
  }

  // --- Admin : articles ---
  if (path === '/api/admin/articles' && method === 'GET') {
    needAdmin()
    const q = url.searchParams
    const flag = (name) => {
      const raw = q.get(name)?.trim().toLowerCase()
      if (!raw) return null
      if (raw !== 'true' && raw !== 'false') throw fieldError(name, "La valeur n'est pas valide.")
      return raw === 'true'
    }
    const categorieId = q.get('categorieId') ? Number(q.get('categorieId')) : null
    if (categorieId !== null && !Number.isInteger(categorieId))
      throw fieldError('categorieId', "La valeur n'est pas valide.")
    const actif = flag('actif')
    const disponible = flag('disponible')
    const term = q.get('recherche')?.trim().toLowerCase()
    const rows = articles
      .filter(
        (a) =>
          (categorieId === null || a.categorieId === categorieId) &&
          (actif === null || a.estActif === actif) &&
          (disponible === null || a.estDisponible === disponible) &&
          (!term || a.nomFr.toLowerCase().includes(term) || a.nomAr.toLowerCase().includes(term)),
      )
      .sort(articleSort)
    const result = paged(rows, paging(url))
    return { status: 200, body: { ...result, items: result.items.map(articleAdmin) } }
  }
  if (path === '/api/admin/articles' && method === 'POST') {
    needAdmin()
    const b = await readJson(req)
    validateArticle(b)
    const now = toIso(Date.now())
    const a = {
      id: Math.max(0, ...articles.map((x) => x.id)) + 1,
      estActif: true,
      dateCreation: now,
      ordre:
        b.ordre ??
        Math.max(
          0,
          ...articles.filter((x) => x.categorieId === b.categorieId).map((x) => x.ordre),
        ) + 1,
    }
    applyArticle(a, b, now)
    articles.push(a)
    return { status: 201, body: articleAdmin(a) }
  }
  if (path === '/api/admin/articles/ordre' && method === 'PUT') {
    needAdmin()
    const ids = readIds(await readJson(req))
    const listed = ids.map(findArticle)
    const unknown = ids.filter((id, i) => !listed[i])
    if (unknown.length) throw fieldError('Ids', `Article(s) inconnu(s) : ${unknown.join(', ')}.`)
    const categorieIds = new Set(listed.map((a) => a.categorieId))
    if (categorieIds.size !== 1)
      throw fieldError('Ids', 'Tous les articles doivent appartenir à la même catégorie.')
    const [categorieId] = categorieIds
    const rest = articles
      .filter((a) => a.categorieId === categorieId && !ids.includes(a.id))
      .sort(byOrdre)
    const now = toIso(Date.now())
    const ordered = [...listed, ...rest]
    renumber(ordered)
    ordered.forEach((a) => (a.dateMiseAJour = now))
    return { status: 200, body: ordered.sort(byOrdre).map(articleAdmin) }
  }
  const artOne = path.match(/^\/api\/admin\/articles\/(\d+)(?:\/(disponible|actif))?$/)
  if (artOne) {
    needAdmin()
    const a = findArticleOr404(artOne[1])
    const now = toIso(Date.now())
    if (method === 'GET' && !artOne[2]) return { status: 200, body: articleAdmin(a) }
    if (method === 'PUT' && !artOne[2]) {
      const b = await readJson(req)
      validateArticle(b)
      applyArticle(a, b, now)
      a.ordre = b.ordre ?? a.ordre
      return { status: 200, body: articleAdmin(a) }
    }
    if (method === 'PATCH' && artOne[2] === 'disponible') {
      a.estDisponible = requireBool(await readJson(req), 'estDisponible', 'EstDisponible')
      a.dateMiseAJour = now
      return { status: 200, body: articleAdmin(a) }
    }
    if (method === 'PATCH' && artOne[2] === 'actif') {
      a.estActif = requireBool(await readJson(req), 'estActif', 'EstActif')
      a.dateMiseAJour = now
      return { status: 200, body: articleAdmin(a) }
    }
  }

  // --- Admin : restaurant ---
  if (path === '/api/admin/restaurant' && method === 'PUT') {
    needAdmin()
    updateRestaurant(await readJson(req))
    return { status: 200, body: restaurantResponse() }
  }
  if (path === '/api/admin/restaurant/horaires' && method === 'PUT') {
    needAdmin()
    updateHoraires(await readJson(req))
    return { status: 200, body: restaurantResponse() }
  }
  if (path === '/api/admin/restaurant/commandes-ouvertes' && method === 'PATCH') {
    needAdmin()
    db.settings.commandesOuvertes = requireBool(
      await readJson(req),
      'commandesOuvertes',
      'CommandesOuvertes',
    )
    return { status: 200, body: restaurantResponse() }
  }

  // --- Admin : tables ---
  if (path === '/api/admin/tables' && method === 'GET') {
    needAdmin()
    return { status: 200, body: [...db.tables].sort(byNumero).map(tableAdmin) }
  }
  if (path === '/api/admin/tables' && method === 'POST') {
    needAdmin()
    const b = await readJson(req)
    const numero = b.numero == null ? Math.max(0, ...db.tables.map((t) => t.numero)) + 1 : b.numero
    if (b.numero == null && numero > NUMERO_MAX)
      throw fieldError('Numero', `Le numéro de table ne peut pas dépasser ${NUMERO_MAX}.`)
    validateTable(numero, b.capacite)
    ensureNumeroFree(numero, null)
    const t = {
      id: db.nextTableId++,
      numero,
      code: randomUUID(),
      capacite: b.capacite,
      estActive: true,
    }
    db.tables.push(t)
    return { status: 201, body: tableAdmin(t) }
  }
  if (path === '/api/admin/tables/salle' && method === 'GET') {
    needAdmin()
    return { status: 200, body: [...db.tables].sort(byNumero).map(salleEntry) }
  }
  const salleAction = path.match(/^\/api\/admin\/tables\/(\d+)\/(encaisser|liberer)$/)
  if (salleAction && method === 'POST') {
    const admin = needAdmin()
    const t = db.tables.find((x) => x.id === Number(salleAction[1]))
    if (!t) throw problem(404, 'Table introuvable.')
    if (salleAction[2] === 'encaisser') encaisserTable(t)
    else libererTable(t, admin)
    return { status: 200, body: salleEntry(t) }
  }
  const tableId = path.match(/^\/api\/admin\/tables\/(\d+)(\/active|\/regenerer-code)?$/)
  if (tableId) {
    const sub = tableId[2]
    if (
      (!sub && (method === 'GET' || method === 'PUT')) ||
      (sub === '/active' && method === 'PATCH') ||
      (sub === '/regenerer-code' && method === 'POST')
    ) {
      needAdmin()
      const t = db.tables.find((x) => x.id === Number(tableId[1]))
      if (!t) throw problem(404, 'Table introuvable.')
      if (method === 'PUT') {
        const b = await readJson(req)
        validateTable(b.numero, b.capacite)
        ensureNumeroFree(b.numero, t.id)
        t.numero = b.numero
        t.capacite = b.capacite
      } else if (method === 'PATCH') {
        t.estActive = requireBool(await readJson(req), 'estActive', 'EstActive')
      } else if (method === 'POST') {
        t.code = randomUUID()
      }
      return { status: 200, body: tableAdmin(t) }
    }
  }

  // --- Admin : utilisateurs ---
  const adminUser = (u) => ({
    id: u.id,
    userName: u.userName,
    email: u.email,
    nom: u.nom,
    estActif: u.estActif,
    dateCreation: u.dateCreation,
  })
  if (path === '/api/admin/users' && method === 'GET') {
    needAdmin()
    const term = url.searchParams.get('search')?.trim().toLowerCase()
    const rows = db.users
      .filter(
        (u) =>
          !term ||
          u.userName.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          (u.nom ?? '').toLowerCase().includes(term),
      )
      .sort((a, b) => a.userName.localeCompare(b.userName, 'en'))
    const result = paged(rows, paging(url))
    return { status: 200, body: { ...result, items: result.items.map(adminUser) } }
  }
  const userActif = path.match(/^\/api\/admin\/users\/([^/]+)\/actif$/)
  if (userActif && method === 'PATCH') {
    const admin = needAdmin()
    const estActif = requireBool(await readJson(req), 'estActif', 'EstActif')
    const id = decodeURIComponent(userActif[1])
    if (!estActif && id === admin.id)
      throw problem(400, 'Un administrateur ne peut pas se désactiver lui-même.')
    const target = db.users.find((u) => u.id === id)
    if (!target) throw problem(404, 'Utilisateur introuvable.')
    target.estActif = estActif
    return { status: 200, body: adminUser(target) }
  }

  // --- Contrôles de test (n'existent PAS dans le vrai back-end) ---
  if (method === 'POST' && path === '/__mock/reset') {
    resetDb() // utilisateurs, sessions, paniers, commandes, menu, restaurant, disponibilités, réglages
    return { status: 204 }
  }
  if (method === 'POST' && path === '/__mock/settings') {
    Object.assign(db.settings, await readJson(req)) // { commandesOuvertes, forceClosed }
    return { status: 200, body: db.settings }
  }
  if (method === 'POST' && path === '/__mock/seed') {
    const b = await readJson(req)
    const count = Math.min(Math.max(Number.isInteger(b.count) ? b.count : 4, 1), 50)
    return { status: 201, body: { ids: seedOrders(count) } }
  }
  if (method === 'POST' && path === '/__mock/salle/seed') {
    return { status: 201, body: { ids: seedSalle() } }
  }
  if (method === 'POST' && path === '/__mock/commandes/new') {
    // Commande « entrante » EnAttente, créée maintenant, pendant que l'écran admin tourne.
    const b = await readJson(req)
    const client = db.users.find((u) => u.id === 'u-client')
    const type = TYPES.includes(b.typeCommande) ? b.typeCommande : 'ARemporter'
    const [nom, tel] = SEED_CLIENTS[db.nextOrderId % SEED_CLIENTS.length]
    const cart = Array.isArray(b.lignes)
      ? b.lignes
          .filter((l) => findArticle(l.articleId))
          .map((l) => [l.articleId, Math.min(Math.max(Number(l.quantite) || 1, 1), MAX_QTY)])
      : sampleCart(db.nextOrderId)
    if (!cart.length) throw fieldError('Lignes', 'Aucun article valide.')
    const order = buildOrder({
      user: client,
      nomClient: b.nomClient ?? nom,
      telephone: b.telephone ?? tel,
      type,
      tableNumero: type === 'SurPlace' ? (b.tableNumero ?? 1) : null,
      adresse:
        type === 'Livraison' ? (b.adresseLivraison ?? '24 rue de Marseille, 1002 Tunis') : null,
      note: b.note,
      cart,
      dateMs: Date.now(),
    })
    return { status: 201, body: adminOrder(order) }
  }
  const adv = path.match(/^\/__mock\/commandes\/(\d+)\/(avancer|statut)$/)
  if (adv && method === 'POST') {
    const order = db.orders.find((o) => o.id === Number(adv[1]))
    if (!order) throw problem(404, 'Commande introuvable.')
    const next =
      adv[2] === 'statut'
        ? (await readJson(req)).statut
        : STATUS_FLOW[STATUS_FLOW.indexOf(order.statut) + 1]
    if (next) {
      order.statut = next
      touch(order, null, next)
    }
    return { status: 200, body: clientOrder(order) }
  }
  if (method === 'POST' && path === '/__mock/articles/disponibilite') {
    const b = await readJson(req) // { id, disponible }
    const a = findArticle(b.id)
    if (a) a.estDisponible = Boolean(b.disponible)
    return { status: 200, body: { id: b.id, disponible: a?.estDisponible } }
  }

  throw problem(404, 'Introuvable (mock)')
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  res.setHeader('Access-Control-Allow-Origin', ORIGIN)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()

  const delay = Number(url.searchParams.get('delay') ?? process.env.MOCK_DELAY_MS ?? 0)
  if (delay) await new Promise((r) => setTimeout(r, delay))

  let result
  try {
    result = await route(req, url, authenticate(req))
  } catch (error) {
    if (error && typeof error.status === 'number') result = error
    else if (error instanceof SyntaxError) result = problem(400, 'Corps JSON invalide.')
    else {
      console.error(error)
      result = problem(500, 'Erreur du mock')
    }
  }
  if (result.body === undefined) return res.writeHead(result.status).end()
  res.writeHead(result.status, {
    'Content-Type':
      result.status >= 400
        ? 'application/problem+json; charset=utf-8'
        : 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(result.body))
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} déjà utilisé (le vrai back-end tourne ?). Relancez avec PORT=5119.`)
    process.exit(1)
  }
  throw error
})
server.listen(PORT, () => console.log(`Mock API sur http://localhost:${PORT} (CORS: ${ORIGIN})`))
