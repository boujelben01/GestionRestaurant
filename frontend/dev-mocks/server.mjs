// Faux back-end de développement (lecture seule) : GET /api/menu?lang=, GET /api/restaurant.
// Hors bundle, aucune dépendance. Voir README.md.
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT ?? 5118)
const ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'
const load = (name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'))

const menu = load('menu.json')
const restaurant = load('restaurant.json')

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

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  res.setHeader('Access-Control-Allow-Origin', ORIGIN)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()

  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }

  if (req.method === 'GET' && url.pathname === '/api/menu') {
    // Simulations utiles : ?fail=1 → 500 ; ?empty=1 → menu vide ; ?delay=800 → latence.
    const delay = Number(url.searchParams.get('delay') ?? 0)
    return setTimeout(() => {
      if (url.searchParams.get('fail')) return send(500, { title: 'Erreur simulée', status: 500 })
      if (url.searchParams.get('empty')) return send(200, [])
      send(200, menuFor(url.searchParams.get('lang') === 'ar' ? 'ar' : 'fr'))
    }, delay)
  }
  if (req.method === 'GET' && url.pathname === '/api/restaurant') {
    return send(200, { ...restaurant, ouvertMaintenant: isOpenNow(restaurant.horaires) })
  }
  send(404, { title: 'Introuvable (mock)', status: 404 })
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} déjà utilisé (le vrai back-end tourne ?). Relancez avec PORT=5119.`)
    process.exit(1)
  }
  throw error
})
server.listen(PORT, () => console.log(`Mock API sur http://localhost:${PORT} (CORS: ${ORIGIN})`))
