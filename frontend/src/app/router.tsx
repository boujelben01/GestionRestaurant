import { Suspense, type ReactNode } from 'react'
import { Navigate, createBrowserRouter, type RouteObject } from 'react-router-dom'
import { Layout, PageFallback } from '@/components/layout/Layout'
import { RequireAuth, RequireRole } from '@/features/auth/guards'
import ErrorPage from '@/pages/ErrorPage'
import {
  AdminLayout,
  AdminMenu,
  AdminOrders,
  AdminRestaurant,
  AdminTables,
  AdminUsers,
  Cart,
  Checkout,
  Contact,
  Forbidden,
  Home,
  Login,
  Menu,
  NotFound,
  OrderConfirmation,
  OrderDetail,
  Orders,
  Profile,
  Register,
  TableEntry,
} from './lazyPages'
import { Root } from './Root'

/** Page réservée aux connectés : redirige vers /connexion (state.from) sinon. */
const guarded = (page: ReactNode) => <RequireAuth fallback={<PageFallback />}>{page}</RequireAuth>

const adminShell = (
  <Suspense fallback={<PageFallback />}>
    <RequireRole role="Admin" fallback={<PageFallback />} forbidden={<Forbidden />}>
      <AdminLayout />
    </RequireRole>
  </Suspense>
)

export const routes: RouteObject[] = [
  {
    element: <Root />,
    // Erreur survenue hors du Layout (rare) : page autonome, sans header/auth.
    errorElement: <ErrorPage />,
    children: [
      {
        path: 'admin',
        element: adminShell,
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <Navigate to="/admin/commandes" replace /> },
          { path: 'commandes', element: <AdminOrders /> },
          { path: 'menu', element: <AdminMenu /> },
          { path: 'restaurant', element: <AdminRestaurant /> },
          { path: 'tables', element: <AdminTables /> },
          { path: 'utilisateurs', element: <AdminUsers /> },
        ],
      },
      {
        element: <Layout />,
        children: [
          {
            // Erreurs de pages (dont chunk introuvable) : affichées dans le Layout, header et footer conservés.
            errorElement: <ErrorPage />,
            children: [
              { index: true, element: <Home /> },
              { path: 'menu', element: <Menu /> },
              { path: 'contact', element: <Contact /> },
              { path: 'connexion', element: <Login /> },
              { path: 'inscription', element: <Register /> },
              { path: 'table/:code', element: <TableEntry /> },
              { path: 'panier', element: guarded(<Cart />) },
              { path: 'commande', element: guarded(<Checkout />) },
              { path: 'commande/:id/confirmation', element: guarded(<OrderConfirmation />) },
              { path: 'commandes', element: guarded(<Orders />) },
              { path: 'commandes/:id', element: guarded(<OrderDetail />) },
              { path: 'profil', element: guarded(<Profile />) },
              { path: '*', element: <NotFound /> },
            ],
          },
        ],
      },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(routes)
