import { lazy } from 'react'

// Une page = un chunk : le shell (layout, UI, auth) reste dans le bundle principal.
export const Home = lazy(() => import('@/pages/Home'))
export const Menu = lazy(() => import('@/pages/Menu'))
export const Contact = lazy(() => import('@/pages/Contact'))
export const Login = lazy(() => import('@/pages/Login'))
export const Register = lazy(() => import('@/pages/Register'))
export const NotFound = lazy(() => import('@/pages/NotFound'))
export const Cart = lazy(() => import('@/pages/Cart'))
export const Checkout = lazy(() => import('@/pages/Checkout'))
export const OrderConfirmation = lazy(() => import('@/pages/OrderConfirmation'))
export const TableEntry = lazy(() => import('@/pages/TableEntry'))

// Placeholders protégés : le contenu arrive à l'étape F4.
export const Orders = lazy(() =>
  import('@/pages/OrdersPlaceholder').then((m) => ({ default: m.OrdersPlaceholder })),
)
export const OrderDetail = lazy(() =>
  import('@/pages/OrdersPlaceholder').then((m) => ({ default: m.OrderDetailPlaceholder })),
)
export const Profile = lazy(() =>
  import('@/pages/OrdersPlaceholder').then((m) => ({ default: m.ProfilePlaceholder })),
)
