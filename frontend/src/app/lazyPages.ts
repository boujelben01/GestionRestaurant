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

export const Orders = lazy(() => import('@/pages/Orders'))
export const OrderDetail = lazy(() => import('@/pages/OrderDetail'))
export const Profile = lazy(() => import('@/pages/Profile'))

// Administration : chargée uniquement pour les comptes Admin.
export const AdminLayout = lazy(() =>
  import('@/components/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })),
)
export const Forbidden = lazy(() => import('@/pages/admin/Forbidden'))
export const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'))
export const AdminMenu = lazy(() => import('@/pages/admin/AdminMenu'))
export const AdminRestaurant = lazy(() => import('@/pages/admin/AdminRestaurant'))
export const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'))
export const AdminTables = lazy(() => import('@/pages/admin/AdminTables'))
