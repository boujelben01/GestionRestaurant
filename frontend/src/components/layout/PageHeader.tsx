import type { ReactNode } from 'react'
import { ZelligePattern } from '@/components/ui'

interface PageHeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  children?: ReactNode
}

/** En-tête de page intérieure : titre display sur bande sable à carreaux atténués. */
export function PageHeader({ title, subtitle, eyebrow, children }: PageHeaderProps) {
  return (
    <header className="relative isolate overflow-hidden bg-sand-100">
      <ZelligePattern className="-z-10 text-terracotta-600 opacity-[0.07]" size={72} />
      <div className="container-page py-10 sm:py-14">
        {eyebrow && <p className="text-eyebrow mb-2 text-terracotta-700">{eyebrow}</p>}
        <h1 className="text-4xl sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-lg text-ink-700">{subtitle}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </header>
  )
}
