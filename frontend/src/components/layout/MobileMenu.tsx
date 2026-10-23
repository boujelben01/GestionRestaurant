import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import type { User } from '@/lib/types'
import {
  ArrowIcon,
  Button,
  CloseIcon,
  Logo,
  UserIcon,
  useFocusTrap,
  useScrollLock,
} from '@/components/ui'
import { ZelligePattern } from '@/components/ui'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ACCOUNT_LINKS, ADMIN_LINK, NAV_ITEMS } from './nav'

interface MobileMenuProps {
  open: boolean
  onClose: () => void
  user: User | null
  onLogout: () => void
}

function MobilePanel({ onClose, user, onLogout }: Omit<MobileMenuProps, 'open'>) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  useScrollLock(true)
  useFocusTrap(ref, true, onClose)

  return (
    <motion.div
      ref={ref}
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label={t('nav.mobile')}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-sand-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <ZelligePattern className="text-terracotta-600 opacity-[0.07]" size={72} />
      <div className="container-page relative flex h-16 shrink-0 items-center justify-between">
        <Logo />
        <button
          type="button"
          onClick={onClose}
          aria-label={t('nav.closeMenu')}
          className="grid size-11 place-items-center rounded-full text-ink-900 transition-colors hover:bg-sand-200"
        >
          <CloseIcon className="size-6" />
        </button>
      </div>

      <nav aria-label={t('nav.main')} className="container-page relative mt-6 flex-1">
        <ul className="flex flex-col">
          {NAV_ITEMS.map((item, index) => (
            <motion.li
              key={item.to}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 + index * 0.07, ease: [0.22, 1, 0.36, 1] }}
              className="border-b border-sand-300/70"
            >
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-16 items-center justify-between font-display text-4xl font-semibold',
                    isActive ? 'text-terracotta-700' : 'text-ink-900',
                  )
                }
              >
                {t(item.key)}
                <ArrowIcon className="size-6 text-terracotta-600" />
              </NavLink>
            </motion.li>
          ))}
        </ul>
      </nav>

      <motion.div
        className="container-page relative flex flex-col gap-5 py-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        {user ? (
          <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-soft">
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.nom?.trim() || user.userName}</p>
              <p className="truncate text-sm text-ink-500" dir="ltr">
                {user.email}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(user.roles.includes('Admin') ? [...ACCOUNT_LINKS, ADMIN_LINK] : ACCOUNT_LINKS).map(
                (item) => (
                  <Button key={item.to} to={item.to} variant="outline" size="sm" onClick={onClose}>
                    {t(item.key)}
                  </Button>
                ),
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              {t('nav.logout')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button to="/connexion" variant="outline" icon={<UserIcon />} onClick={onClose}>
              {t('nav.login')}
            </Button>
            <Button to="/inscription" onClick={onClose}>
              {t('nav.register')}
            </Button>
          </div>
        )}
        <div className="flex justify-center">
          <LanguageSwitcher />
        </div>
      </motion.div>
    </motion.div>
  )
}

/** Navigation plein écran (mobile) : focus piégé, Échap, scroll verrouillé, entrée en cascade. */
export function MobileMenu({ open, ...props }: MobileMenuProps) {
  return createPortal(
    <AnimatePresence>{open && <MobilePanel key="mobile-menu" {...props} />}</AnimatePresence>,
    document.body,
  )
}
