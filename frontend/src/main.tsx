import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// i18n d'abord : la langue (et <html lang dir>) doit être posée avant le premier rendu.
import '@/lib/i18n'
// Cairo : arabe uniquement, quatre graisses (texte, medium, semi-gras, gras).
import '@fontsource/cairo/arabic-400.css'
import '@fontsource/cairo/arabic-500.css'
import '@fontsource/cairo/arabic-600.css'
import '@fontsource/cairo/arabic-700.css'
import '@/styles/index.css'
import App from '@/app/App'
import { Providers } from '@/app/providers'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
