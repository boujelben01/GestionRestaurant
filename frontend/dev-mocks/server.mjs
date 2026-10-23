// Faux back-end de développement, état EN MÉMOIRE (perdu au redémarrage) : menu, restaurant,
// auth, profil, panier, commandes, tables. Reproduit les règles du vrai back-end (plafond 20,
// 409 indisponible, minimum de livraison...). Hors bundle, aucune dépendance. Voir README.md.
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT ?? 5118)
const ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'
const load = (name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'))

const menu = load('menu.json')
const restaurant = load('restaurant.json')

const TOKEN_TTL_MS = Number(process.env.TOKEN_TTL_MS ?? 3_600_000)
const MAX_QTY = 20
// Codes de table valides (le QR encode /table/<code>).
const TABLES = {
  '11111111-1111-4111-8111-111111111111': 1,
  '55555555-5555-4555-8555-555555555555': 5,
}
const STATUS_FLOW = ['EnAttente', 'EnPreparation', 'Prete', 'Terminee']

// ---------------------------------------------------------------------------------------------
// État en mémoire
// ---------------------------------------------------------------------------------------------
let db
function resetDb() {
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
      },
    ],
    sessions: new Map(), // token -> { userId, expires }
    carts: new Map(), // userId -> Map(articleId -> quantite)
    orders: [],
    nextOrderId: 1,
    settings: {
      commandesOuvertes: restaurant.commandesOuvertes ?? true,
      forceClosed: false,
      // MOCK_ALWAYS_OPEN=1 : ignore les horaires (utile le dimanche ou la nuit).
      alwaysOpen: process.env.MOCK_ALWAYS_OPEN === '1',
    },
  }
}
resetDb()

const allArticles = () => menu.flatMap((c) => c.articles)
const findArticle = (id) => allArticles().find((a) => a.id === id)
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
const toIso = (d) => new Date(d).toISOString()
const publicUser = (u) => ({
  id: u.id,
  userName: u.userName,
  nom: u.nom,
  email: u.email,
  telephone: u.telephone,
  roles: u.roles,
  langueFavorite: u.langueFavorite,
})

function cartResponse(userId, lang) {
  const cart = db.carts.get(userId) ?? new Map()
  const lignes = [...cart.entries()].map(([articleId, quantite]) => {
    const a = findArticle(articleId)
    return {
      articleId,
      nom: a.nom[lang],
      prixUnitaire: a.prix,
      imageUrl: a.imageUrl,
      disponible: a.disponible,
      quantite,
      totalLigne: round2(a.prix * quantite),
      avertissement: a.disponible ? null : 'indisponible',
    }
  })
  return {
    lignes,
    nombreArticles: lignes.reduce((n, l) => n + l.quantite, 0),
    sousTotal: round2(lignes.reduce((n, l) => n + l.totalLigne, 0)),
    dateMiseAJour: lignes.length ? toIso(Date.now()) : null,
  }
}

const orderResume = (o) => ({
  id: o.id,
  numero: o.numero,
  statut: o.statut,
  typeCommande: o.typeCommande,
  total: o.total,
  nombreArticles: o.lignes.reduce((n, l) => n + l.quantite, 0),
  dateCommande: o.dateCommande,
})

/** Erreur RFC 7807 : à `throw` depuis une route. */
function problem(status, title, errors) {
  return { status, body: { status, title, ...(errors ? { errors } : {}) } }
}
const fieldError = (field, message) =>
  problem(400, 'Une ou plusieurs erreurs de validation se sont produites.', { [field]: [message] })

function menuFor(lang) {
  return menu.map((category) => ({
    id: category.id,
    nom: category.nom[lang],
    ordre: category.ordre,
    articles: category.articles.map((article, index) => ({
      id: article.id,
      categorieId: category.id,
      nom: article.nom[lang],
      description: article.description[lang],
      prix: article.prix,
      imageUrl: article.imageUrl,
      estPopulaire: article.estPopulaire,
      disponible: article.disponible,
      ordre: index,
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
  return db.users.find((u) => u.id === session.userId) ?? null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/
const qtyError = () =>
  fieldError('Quantite', `La quantité doit être comprise entre 1 et ${MAX_QTY}.`)

/** Retourne { status, body } (body absent = pas de contenu) ; les erreurs sont lancées via problem(). */
async function route(req, url, user) {
  const { pathname: path } = url
  const method = req.method
  const lang = url.searchParams.get('lang') === 'ar' ? 'ar' : 'fr'
  const need = () => {
    if (!user) throw problem(401, 'Authentification requise.')
    return user
  }

  // --- Public ---
  if (method === 'GET' && path === '/api/menu') {
    // Simulations : ?fail=1 → 500 ; ?empty=1 → menu vide ; ?delay=800 → latence.
    if (url.searchParams.get('fail')) throw problem(500, 'Erreur simulée')
    if (url.searchParams.get('empty')) return { status: 200, body: [] }
    return { status: 200, body: menuFor(lang) }
  }
  if (method === 'GET' && path === '/api/restaurant') {
    const open = openNow()
    return {
      status: 200,
      body: {
        ...restaurant,
        commandesOuvertes: db.settings.commandesOuvertes,
        ouvertMaintenant: open,
      },
    }
  }
  const table = path.match(/^\/api\/tables\/([^/]+)$/)
  if (method === 'GET' && table) {
    const numero = TABLES[table[1].toLowerCase()]
    if (!numero) throw problem(404, 'Table introuvable.')
    return { status: 200, body: { numero } }
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
    if (!a) throw problem(404, 'Article introuvable.')
    if (!a.disponible) throw problem(409, "Cet article n'est pas disponible pour le moment.")
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
    if ((!cart.has(id) || b.quantite > cart.get(id)) && !a.disponible)
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

  // --- Commandes ---
  if (path === '/api/commandes' && method === 'POST')
    return { status: 201, body: await createOrder(need(), await readJson(req)) }
  if (path === '/api/commandes' && method === 'GET') {
    const u = need()
    const page = Math.max(Number(url.searchParams.get('page') ?? 1), 1)
    const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? 20), 1), 50)
    const mine = db.orders.filter((o) => o.userId === u.id).sort((a, b) => b.id - a.id)
    const items = mine.slice((page - 1) * pageSize, page * pageSize).map(orderResume)
    return { status: 200, body: { items, page, pageSize, total: mine.length } }
  }
  const one = path.match(/^\/api\/commandes\/(\d+)(\/annuler)?$/)
  if (one) {
    const u = need()
    const order = db.orders.find((o) => o.id === Number(one[1]) && o.userId === u.id)
    if (!order) throw problem(404, 'Commande introuvable.')
    if (method === 'GET' && !one[2]) return { status: 200, body: order }
    if (method === 'POST' && one[2]) {
      if (order.statut !== 'EnAttente')
        throw problem(409, 'Seule une commande en attente peut être annulée.')
      order.statut = 'Annulee'
      order.historique.push({ statut: 'Annulee', date: toIso(Date.now()) })
      return { status: 200, body: order }
    }
  }

  // --- Contrôles de test (n'existent PAS dans le vrai back-end) ---
  if (method === 'POST' && path === '/__mock/reset') {
    resetDb()
    return { status: 204 }
  }
  if (method === 'POST' && path === '/__mock/settings') {
    Object.assign(db.settings, await readJson(req)) // { commandesOuvertes, forceClosed }
    return { status: 200, body: db.settings }
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
      order.historique.push({ statut: next, date: toIso(Date.now()) })
    }
    return { status: 200, body: order }
  }
  if (method === 'POST' && path === '/__mock/articles/disponibilite') {
    const b = await readJson(req) // { id, disponible }
    const a = findArticle(b.id)
    if (a) a.disponible = Boolean(b.disponible)
    return { status: 200, body: { id: b.id, disponible: a?.disponible } }
  }

  throw problem(404, 'Introuvable (mock)')
}

async function createOrder(u, b) {
  const type = b.typeCommande
  if (!['SurPlace', 'ARemporter', 'Livraison'].includes(type))
    throw fieldError('TypeCommande', 'Le type de commande est invalide.')
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
  if (type === 'SurPlace') {
    tableNumero = TABLES[String(b.tableCode).toLowerCase()] ?? null
    if (!tableNumero) throw fieldError('TableCode', 'Table inconnue ou inactive.')
  }

  const cart = db.carts.get(u.id)
  if (!cart || cart.size === 0) throw fieldError('Panier', 'Votre panier est vide.')
  const blocked = [...cart.keys()].map(findArticle).filter((a) => !a.disponible)
  if (blocked.length)
    throw problem(
      409,
      `Ces articles ne sont plus disponibles : ${blocked.map((a) => a.nom.fr).join(', ')}. Retirez-les de votre panier.`,
    )

  const lignes = [...cart.entries()].map(([id, quantite]) => {
    const a = findArticle(id)
    return {
      articleId: id,
      nomFr: a.nom.fr,
      nomAr: a.nom.ar,
      prixUnitaire: a.prix,
      quantite,
      totalLigne: round2(a.prix * quantite),
    }
  })
  const sousTotal = round2(lignes.reduce((n, l) => n + l.totalLigne, 0))
  if (type === 'Livraison' && sousTotal < restaurant.montantMinimumLivraison)
    throw fieldError(
      'Panier',
      `Le montant minimum pour une livraison est de ${restaurant.montantMinimumLivraison.toFixed(2)} DT (sous-total actuel : ${sousTotal.toFixed(2)} DT).`,
    )
  const frais = type === 'Livraison' ? round2(restaurant.fraisLivraison) : 0

  const id = db.nextOrderId++
  const now = toIso(Date.now())
  const order = {
    id,
    userId: u.id,
    numero: `CMD-${String(id).padStart(6, '0')}`,
    statut: 'EnAttente',
    typeCommande: type,
    modePaiement: 'Especes',
    estPayee: false,
    sousTotal,
    fraisLivraison: frais,
    total: round2(sousTotal + frais),
    note: b.note?.trim() || null,
    adresseLivraison: adresse,
    tableNumero,
    dateCommande: now,
    lignes,
    historique: [{ statut: 'EnAttente', date: now }],
  }
  db.orders.push(order)
  db.carts.delete(u.id)
  return order
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
