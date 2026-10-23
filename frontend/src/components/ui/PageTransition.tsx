import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { useLocation } from 'react-router-dom'

/** Fondu + légère montée à chaque changement de page (clé = chemin). */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <motion.div
      key={pathname}
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
