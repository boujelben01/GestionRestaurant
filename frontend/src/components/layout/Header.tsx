import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/AuthContext'
import { useCartCount } from '@/features/cart/api'
import { cn } from '@/lib/cn'
import type { User } from '@/lib/types'
import {
  Button,
  CartIcon,
  ChevronDownIcon,
  Logo,
  MenuIcon,
  UserIcon,
  useToast,
} from '@/components/ui'
import { LanguageSwitcher } from './LanguageSwitcher'
import { MobileMenu } from './MobileMenu'
import { ACCOUNT_LINKS, NAV_ITEMS } from './nav'

function displayName(user: User) {
  return user.nom?.trim() || user.userName
}

/** Lien panier : compteur réel (0 pour un invité), badge animé en opacité + échelle. */
function CartLink() {
  const { t } = useTranslation()
  const count = useCartCount()
  return (
    <Link
      to="/panier"
      aria-label={t('a11y.cartCount', { count })}
      className="relative grid size-11 place-items-center rounded-full text-ink-700 transition-colors hover:bg-sand-200"
    >
      <CartIcon className="size-6" />
      <motion.span
        key={count}
        aria-hidden="true"
        initial={{ scale: 0.6, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        className={cn(
          'tabular absolute end-0.5 top-0.5 grid min-w-5 place-items-center rounded-full px-1 text-[11px] leading-5 font-bold',
          count > 0 ? 'bg-terracotta-600 text-white' : 'bg-ink-700 text-sand-50',
        )}
      >
        {count}
      </motion.span>
    </Link>
  )
}

/** Menu utilisateur (bureau) : disclosure simple, fermé par Échap / clic extérieur. */
function UserMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const name = displayName(user)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        rootRef.current?.querySelector<HTMLElement>('button')?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="user-menu"
        aria-label={t('a11y.userMenu', { name })}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-2 rounded-full bg-sand-200/80 ps-1.5 pe-3 text-sm font-semibold text-ink-900 transition-colors hover:bg-sand-300/70"
      >
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full bg-terracotta-600 text-sm font-bold text-white uppercase"
        >
          {name.charAt(0)}
        </span>
        <span className="max-w-28 truncate">{name}</span>
        <ChevronDownIcon
          className={cn('size-4 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id="user-menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute end-0 top-full z-40 mt-2 w-64 rounded-lg bg-white p-2 shadow-float"
          >
            <div className="px-3 py-2">
              <p className="truncate font-semibold">{name}</p>
              <p className="truncate text-sm text-ink-500" dir="ltr">
                {user.email}
              </p>
            </div>
            <nav
              aria-label={t('nav.account')}
              className="flex flex-col border-t border-sand-200 py-1"
            >
              {ACCOUNT_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold transition-colors hover:bg-sand-100"
                >
                  {t(item.key)}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              className="flex min-h-11 w-full items-center rounded-md px-3 text-start text-sm font-semibold text-danger-600 transition-colors hover:bg-danger-100"
            >
              {t('nav.logout')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Header() {
  const { t } = useTranslation()
  const { user, status, logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  // Le menu mobile est « ouvert pour cette navigation » : une nouvelle route le ferme sans effet.
  const [openKey, setOpenKey] = useState<string | null>(null)
  const menuOpen = openKey === location.key
  const burgerRef = useRef<HTMLButtonElement>(null)

  const handleLogout = () => {
    logout()
    toast(t('auth.loggedOut'), { variant: 'success' })
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-sand-200/80 bg-sand-50/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-2 sm:h-[4.5rem]">
        <Link
          to="/"
          aria-label={`${t('brand.name')} — ${t('nav.home')}`}
          className="-ms-1 rounded-full px-1 py-1"
        >
          <Logo />
        </Link>

        <nav aria-label={t('nav.main')} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'relative inline-flex min-h-11 items-center rounded-full px-4 text-[0.95rem] font-semibold transition-colors duration-200',
                      isActive
                        ? 'bg-terracotta-100 text-terracotta-700'
                        : 'text-ink-700 hover:bg-sand-200/70 hover:text-ink-900',
                    )
                  }
                >
                  {t(item.key)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          <CartLink />
          <div className="hidden md:block">
            {status === 'authenticated' && user ? (
              <UserMenu user={user} onLogout={handleLogout} />
            ) : (
              <Button to="/connexion" variant="outline" size="sm" icon={<UserIcon />}>
                {t('nav.login')}
              </Button>
            )}
          </div>
          <button
            ref={burgerRef}
            type="button"
            aria-label={t('nav.openMenu')}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setOpenKey(location.key)}
            className="grid size-11 place-items-center rounded-full text-ink-900 transition-colors hover:bg-sand-200 md:hidden"
          >
            <MenuIcon className="size-6" />
          </button>
        </div>
      </div>

      <MobileMenu
        open={menuOpen}
        onClose={() => setOpenKey(null)}
        user={status === 'authenticated' ? user : null}
        onLogout={() => {
          setOpenKey(null)
          handleLogout()
        }}
      />
    </header>
  )
}
