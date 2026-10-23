import { Suspense, useEffect, useRef, type RefObject } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { PageTransition, Skeleton, Toaster } from '@/components/ui'
import { Footer } from './Footer'
import { Header } from './Header'

export function PageFallback() {
  const { t } = useTranslation()
  return (
    <div className="container-page flex-1 py-12" role="status" aria-label={t('a11y.loadingPage')}>
      <Skeleton className="mb-4 h-10 w-2/3 max-w-md" />
      <Skeleton className="mb-3 h-5 w-full max-w-xl" />
      <Skeleton className="mb-10 h-5 w-4/5 max-w-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
}

/** À chaque navigation : retour en haut et focus sur <main> (annonce le changement de page). */
function useRouteFocus(mainRef: RefObject<HTMLElement | null>) {
  const { pathname, hash } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname, hash, mainRef])
}

export function Layout() {
  const { t } = useTranslation()
  const mainRef = useRef<HTMLElement>(null)
  useRouteFocus(mainRef)

  return (
    <>
      <Seo />
      <a
        href="#contenu"
        className="sr-only z-[70] rounded-full bg-ink-900 px-5 py-3 font-semibold text-sand-50 focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t('a11y.skipToContent')}
      </a>
      <Header />
      <main id="contenu" ref={mainRef} tabIndex={-1} className="flex flex-1 flex-col">
        <Suspense fallback={<PageFallback />}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </Suspense>
      </main>
      <Footer />
      <Toaster />
    </>
  )
}
