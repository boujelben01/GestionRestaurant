import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import ErrorPage from '@/pages/ErrorPage'
import { Contact, Home, Login, Menu, NotFound, Register } from './lazyPages'
import { Root } from './Root'

export const routes: RouteObject[] = [
  {
    element: <Root />,
    // Erreur survenue hors du Layout (rare) : page autonome, sans header/auth.
    errorElement: <ErrorPage />,
    children: [
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
              { path: '*', element: <NotFound /> },
            ],
          },
        ],
      },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(routes)
