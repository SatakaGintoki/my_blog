import { createBrowserRouter } from 'react-router-dom'
import { lazy } from 'react'
import App from './App'
import { AboutPage, ArchivePage, ArticlePage, HomePage, NotFound, PublicLayout } from './public'
import { previewEnabled } from './site-defaults'
const AdminLayout = lazy(() => import('./admin').then(m => ({ default: m.AdminLayout })))
const LoginPage = lazy(() => import('./admin').then(m => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('./admin').then(m => ({ default: m.DashboardPage })))
const AdminPostsPage = lazy(() => import('./admin').then(m => ({ default: m.AdminPostsPage })))
const AdminCommentsPage = lazy(() => import('./admin').then(m => ({ default: m.AdminCommentsPage })))
const EditorPage = lazy(() => import('./editor').then(m => ({ default: m.EditorPage })))
const SettingsPage = lazy(() => import('./settings').then(m => ({ default: m.SettingsPage })))
const TaxonomyPage = lazy(() => import('./settings').then(m => ({ default: m.TaxonomyPage })))

const publicRoutes = [
  { index: true, element: <HomePage/> }, { path: 'articles', element: <HomePage listing/> },
  { path: 'archive', element: <ArchivePage/> }, { path: 'about', element: <AboutPage/> },
  { path: 'posts/:slug', element: <ArticlePage/> }, { path: '*', element: <NotFound/> },
]
export const router = createBrowserRouter([{ element: <App/>, children: [
  { path: '/', element: <PublicLayout/>, children: publicRoutes },
  ...(previewEnabled ? [{ path: '/preview', element: <PublicLayout/>, children: publicRoutes }] : []),
  { path: '/admin/login', element: <LoginPage/> },
  { path: '/admin', element: <AdminLayout/>, children: [
    { index: true, element: <DashboardPage/> }, { path: 'posts', element: <AdminPostsPage/> },
    { path: 'posts/new', element: <EditorPage/> }, { path: 'posts/:id', element: <EditorPage/> },
    { path: 'comments', element: <AdminCommentsPage/> }, { path: 'taxonomy', element: <TaxonomyPage/> },
    { path: 'settings', element: <SettingsPage/> }, { path: '*', element: <NotFound/> },
  ] },
] }])
