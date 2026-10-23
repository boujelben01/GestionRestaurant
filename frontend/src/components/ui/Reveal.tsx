import type { ReactNode } from 'react'
import { motion } from 'motion/react'

const tags = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  li: motion.li,
  ul: motion.ul,
} as const

/** Décalage entre deux éléments successifs d'une liste révélée (en secondes). */
export const REVEAL_STAGGER = 0.07

interface RevealProps {
  children: ReactNode
  as?: keyof typeof tags
  className?: string
  /** Rang dans la liste : retarde l'apparition de `index × stagger`. */
  index?: number
  stagger?: number
  /** Retard additionnel en secondes. */
  delay?: number
  /** Distance de glissement initiale en px. */
  y?: number
}

/**
 * Apparition douce au scroll (opacité + translation seulement). Rejouée jamais (once).
 * Sous prefers-reduced-motion, MotionConfig neutralise la translation.
 */
export function Reveal({
  children,
  as = 'div',
  className,
  index = 0,
  stagger = REVEAL_STAGGER,
  delay = 0,
  y = 18,
}: RevealProps) {
  const Tag = tags[as]
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: delay + index * stagger }}
    >
      {children}
    </Tag>
  )
}
