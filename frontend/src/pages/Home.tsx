import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import {
  ArrowIcon,
  Button,
  EmptyState,
  ErrorState,
  PlateIcon,
  Reveal,
  Tooltip,
  ZelligeDivider,
  ZelligePattern,
} from '@/components/ui'
import { ConnectedArticleCard } from '@/features/cart/ConnectedArticleCard'
import { useMenu } from '@/features/menu/api'
import { ArticleGridSkeleton } from '@/features/menu/MenuSkeleton'
import { InfoBand } from '@/features/restaurant/InfoBand'
import { OpenStatusBadge } from '@/features/restaurant/OpenStatusBadge'

const POPULAR_LIMIT = 6

function Hero() {
  const { t } = useTranslation()
  return (
    <section className="relative isolate overflow-hidden bg-sand-100">
      <ZelligePattern className="-z-10 text-terracotta-600 opacity-[0.07]" size={84} />
      <div className="container-page grid min-h-[min(calc(100dvh-4rem),50rem)] items-center gap-10 py-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="max-w-xl">
          <Reveal>
            <OpenStatusBadge />
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-eyebrow mt-6 text-terracotta-700">{t('home.eyebrow')}</p>
            <h1 className="mt-3 text-5xl sm:text-6xl lg:text-7xl">{t('home.title')}</h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 text-lg text-ink-700 sm:text-xl">{t('home.subtitle')}</p>
          </Reveal>
          <Reveal delay={0.24} className="mt-8 flex flex-wrap gap-3">
            <Button to="/menu" size="lg" icon={<ArrowIcon />}>
              {t('common.seeMenu')}
            </Button>
            <Tooltip content={t('home.reserveSoon')} placement="top" align="start">
              <Button
                variant="outline"
                size="lg"
                aria-disabled="true"
                className="pointer-events-auto! cursor-not-allowed"
              >
                {t('home.reserve')}
              </Button>
            </Tooltip>
          </Reveal>
        </div>

        {/* Cadre en arche : la photo (750 px) reste nette car affichée à ~450 px de large. */}
        <Reveal delay={0.12} className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            aria-hidden="true"
            className="absolute inset-0 translate-x-3 translate-y-3 rounded-t-[12rem] rounded-b-2xl border-2 border-sidi-600/40 rtl:-translate-x-3"
          />
          <div className="relative aspect-[6/5] overflow-hidden rounded-t-[12rem] rounded-b-2xl bg-sand-200 shadow-lift">
            <img
              src="/images/makloub.png"
              alt={t('home.heroImageAlt')}
              width={750}
              height={400}
              className="size-full object-cover"
            />
          </div>
          <img
            src="/images/plat-tounsi.jpg"
            alt={t('home.secondaryImageAlt')}
            width={502}
            height={327}
            loading="lazy"
            className="absolute -start-4 -bottom-6 size-28 rounded-full border-4 border-sand-50 object-cover shadow-lift sm:size-36"
          />
        </Reveal>
      </div>
    </section>
  )
}

function PopularSection() {
  const { t } = useTranslation()
  const { data, isPending, isError, error, refetch, isFetching } = useMenu()
  const popular = (data ?? [])
    .flatMap((category) => category.articles)
    .filter((article) => article.estPopulaire)
    .slice(0, POPULAR_LIMIT)

  return (
    <section aria-labelledby="popular-title" className="container-page pt-24 pb-8">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow text-terracotta-700">{t('home.popularSubtitle')}</p>
          <h2 id="popular-title" className="mt-2 text-3xl sm:text-4xl">
            {t('home.popularTitle')}
          </h2>
        </div>
        <Button to="/menu" variant="ghost" size="sm" icon={<ArrowIcon className="size-4" />}>
          {t('home.seeAll')}
        </Button>
      </Reveal>

      <div className="mt-8">
        {isPending && <ArticleGridSkeleton count={3} />}
        {isError && (
          <ErrorState
            error={error}
            message={t('menu.loadError')}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        )}
        {data && popular.length === 0 && (
          <EmptyState
            icon={<PlateIcon />}
            title={t('home.popularEmptyTitle')}
            description={t('home.popularEmptyText')}
            action={
              <Button to="/menu" size="sm">
                {t('common.seeMenu')}
              </Button>
            }
          />
        )}
        {popular.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((article, index) => (
              <Reveal as="li" key={article.id} index={index % 3} className="h-full">
                <ConnectedArticleCard article={article} />
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/*
 * TODO(contenu) : textes d'ambiance volontairement génériques (home.story.*, home.why*) :
 * aucun fait précis (date, fondateur, origine). À remplacer par l'histoire réelle du restaurant.
 */
function StorySection() {
  const { t } = useTranslation()
  const values = [1, 2, 3] as const
  return (
    <section aria-labelledby="story-title" className="container-page py-24">
      <ZelligeDivider className="mx-auto mb-16 max-w-sm" />
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <img
            src="/images/brownie.jpg"
            alt={t('home.story.imageAlt')}
            width={2000}
            height={1333}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full rounded-xl object-cover shadow-lift"
          />
        </Reveal>
        <div>
          <Reveal>
            <p className="text-eyebrow text-terracotta-700">{t('home.story.eyebrow')}</p>
            <h2 id="story-title" className="mt-2 text-3xl sm:text-4xl">
              {t('home.story.title')}
            </h2>
            <p className="mt-4 text-lg text-ink-700">{t('home.story.p1')}</p>
            <p className="mt-3 text-lg text-ink-700">{t('home.story.p2')}</p>
          </Reveal>
        </div>
      </div>

      <h3 className="sr-only">{t('home.whyTitle')}</h3>
      <ul className="mt-16 grid gap-6 md:grid-cols-3">
        {values.map((n, index) => (
          <Reveal
            as="li"
            key={n}
            index={index}
            className="rounded-lg border border-sand-300 bg-white/60 p-6"
          >
            <span
              aria-hidden="true"
              className="mb-4 grid size-10 place-items-center rounded-full bg-terracotta-100 font-display text-lg font-bold text-terracotta-700"
            >
              {n}
            </span>
            <p className="font-display text-xl font-semibold">{t(`home.why${n}Title`)}</p>
            <p className="mt-2 text-ink-700">{t(`home.why${n}Text`)}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  )
}

function FinalCta() {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="cta-title" className="container-page py-20">
      <Reveal className="relative isolate overflow-hidden rounded-xl bg-terracotta-700 px-6 py-14 text-center text-white sm:px-12">
        <ZelligePattern className="-z-10 text-white opacity-[0.1]" size={72} />
        <h2 id="cta-title" className="text-3xl sm:text-5xl">
          {t('home.cta.title')}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-terracotta-100">{t('home.cta.text')}</p>
        <Button to="/menu" variant="secondary" size="lg" className="mt-8" icon={<ArrowIcon />}>
          {t('common.seeMenu')}
        </Button>
      </Reveal>
    </section>
  )
}

export default function Home() {
  const { t } = useTranslation()
  return (
    <>
      <Seo title={t('seo.homeTitle')} description={t('seo.homeDescription')} />
      <Hero />
      <PopularSection />
      <StorySection />
      <InfoBand />
      <FinalCta />
    </>
  )
}
