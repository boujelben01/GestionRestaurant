import { lazy } from 'react'

// Une page = un chunk : le shell (layout, UI, auth) reste dans le bundle principal.
export const Home = lazy(() => import('@/pages/Home'))
export const Menu = lazy(() => import('@/pages/Menu'))
export const Contact = lazy(() => import('@/pages/Contact'))
export const Login = lazy(() => import('@/pages/Login'))
export const Register = lazy(() => import('@/pages/Register'))
export const NotFound = lazy(() => import('@/pages/NotFound'))
