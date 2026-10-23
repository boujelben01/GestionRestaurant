import { Suspense, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { PageFallback } from '@/components/layout/Layout'
import { Seo } from '@/components/Seo'
import {
  BagIcon,
  Button,
  CloseIcon,
  Logo,
  MenuIcon,
  PlateIcon,
  SettingsIcon,
  Toaster,
  UsersIcon,
  useFocusTrap,
  useScrollLock,
  useToast,
} from '@/components/ui'
import { useOrderCounters } from '@/features/admin/orders/api'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/lib/cn'

const ITEMS: Array<{ to: string; key: string; icon: ReactNode }> = [
  { to: '/admin/commandes', key: 'admin.nav.orders', icon: <BagIcon className="size-5" /> },
  { to: '/admin/menu', key: 'admin.nav.menu', icon: <PlateIcon className="size-5" /> },
  {
    to: '/admin/restaurant',
    key: 'admin.nav.restaurant',
    icon: <SettingsIcon className="size-5" />,
  },
  { to: '/admin/utilisateurs', key: 'admin.nav.users', icon: <UsersIcon className="size-5" /> },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { data: counters } = useOrderCounters()
  const waiting = counters?.enAttente ?? 0
  return (
    <nav aria-label={t('admin.nav.main')}>
      <ul className="flex flex-col gap-1">
        {ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex min-h-12 items-center gap-3 rounded-md px-3 font-semibold transition-colors duration-200',
                  isActive
                    ? 'bg-terracotta-100 text-terracotta-700'
                    : 'text-ink-700 hover:bg-sand-200/70 hover:text-ink-900',
                )
              }
            >
              {item.icon}
              <span className="flex-1">{t(item.key)}</span>
              {item.to === '/admin/commandes' && waiting > 0 && (
                <span
                  className="tabular grid min-w-6 place-items-center rounded-full bg-terracotta-600 px-1.5 text-xs leading-6 font-bold text-white"
                  aria-label={t('admin.nav.pendingCount', { count: waiting })}
                >
                  {waiting}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Drawer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  useScrollLock(true)
  useFocusTrap(ref, true, onClose)
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-ink-900/55"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t('admin.nav.main')}
        tabIndex={-1}
        className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col gap-6 bg-sand-50 p-4 shadow-float"
        initial={{ opacity: 0, x: document.documentElement.dir === 'rtl' ? 32 : -32 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: document.documentElement.dir === 'rtl' ? 32 : -32 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('admin.nav.close')}
            className="grid size-11 place-items-center rounded-full hover:bg-sand-200"
          >
            <CloseIcon className="size-6" />
          </button>
        </div>
        <NavList onNavigate={onClose} />
      </motion.div>
    </div>
  )
}

const TITLES: Record<string, string> = {
  commandes: 'admin.nav.orders',
  menu: 'admin.nav.menu',
  restaurant: 'admin.nav.restaurant',
  utilisateurs: 'admin.nav.users',
}

/** Coque d'administration : navigation latérale (desktop), tiroir (mobile), en-tête sobre. */
export function AdminLayout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  // Tiroir « ouvert pour cette navigation » : une nouvelle route le ferme sans effet.
  const [openKey, setOpenKey] = useState<string | null>(null)
  const drawerOpen = openKey === location.key
  const section = location.pathname.split('/')[2] ?? ''
  const title = t(TITLES[section] ?? 'admin.nav.title')

  return (
    <>
      <Seo noindex />
      <a
        href="#admin-contenu"
        className="sr-only z-[70] rounded-full bg-ink-900 px-5 py-3 font-semibold text-sand-50 focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t('a11y.skipToContent')}
      </a>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-e border-sand-200 bg-sand-100/60 p-4 lg:flex">
          <Link
            to="/admin/commandes"
            aria-label={t('admin.nav.title')}
            className="rounded-full px-1 py-1"
          >
            <Logo />
          </Link>
          <NavList />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 border-b border-sand-200 bg-sand-50/90 px-4 py-2 backdrop-blur-md sm:px-6">
            <button
              type="button"
              onClick={() => setOpenKey(location.key)}
              aria-label={t('admin.nav.open')}
              aria-expanded={drawerOpen}
              className="grid size-11 place-items-center rounded-full hover:bg-sand-200 lg:hidden"
            >
              <MenuIcon className="size-6" />
            </button>
            <h1 className="me-auto text-xl sm:text-2xl">{title}</h1>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-sidi-700 underline-offset-4 hover:underline"
            >
              {t('admin.nav.viewSite')}
            </Link>
            <LanguageSwitcher />
            <div className="flex items-center gap-2">
              <span className="hidden max-w-36 truncate text-sm font-semibold sm:inline">
                {user?.nom?.trim() || user?.userName}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  logout()
                  toast(t('auth.loggedOut'), { variant: 'success' })
                  void navigate('/')
                }}
              >
                {t('nav.logout')}
              </Button>
            </div>
          </header>

          <main id="admin-contenu" tabIndex={-1} className="flex-1 px-4 py-6 sm:px-6">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {drawerOpen && <Drawer key="drawer" onClose={() => setOpenKey(null)} />}
        </AnimatePresence>,
        document.body,
      )}
      <Toaster />
    </>
  )
}
