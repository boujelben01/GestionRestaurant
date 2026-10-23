export const NAV_ITEMS = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/menu', key: 'nav.menu', end: false },
  { to: '/contact', key: 'nav.contact', end: false },
] as const

/** Liens du compte (menu utilisateur et menu mobile) ; pages protégées. */
export const ACCOUNT_LINKS = [
  { to: '/commandes', key: 'nav.orders' },
  { to: '/profil', key: 'nav.profile' },
] as const

/** Lien d'administration : affiché seulement aux comptes ayant le rôle Admin. */
export const ADMIN_LINK = { to: '/admin', key: 'nav.admin' } as const
