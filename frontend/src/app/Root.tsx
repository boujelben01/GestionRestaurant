import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui'
import { AuthProvider } from '@/features/auth/AuthContext'

/** Racine du Router : monte l'AuthProvider et renvoie vers /connexion quand la session expire. */
export function Root() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <AuthProvider
      onSessionEnded={() => {
        toast(t('auth.sessionExpired'))
        void navigate('/connexion', {
          replace: true,
          state: { from: location.pathname + location.search },
        })
      }}
    >
      <Outlet />
    </AuthProvider>
  )
}
