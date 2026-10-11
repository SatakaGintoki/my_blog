import { createContext, useContext, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { api, session, useApi } from './api'
import { defaultSite, previewEnabled } from './site-defaults'
import type { Post, Site, Taxonomy } from './types'

interface BlogContextValue {
  site: Site; categories: Taxonomy[]; tags: Taxonomy[]; preview: boolean; previewPosts: Post[]; previewLoading: boolean;
  refresh: () => void; metadataError: string; authenticated: boolean; authenticate: (token: string) => void; forget: () => void;
}
const BlogContext = createContext<BlogContextValue>(null!)
export const useBlog = () => useContext(BlogContext)

export default function App() {
  const location = useLocation()
  const preview = previewEnabled && (location.pathname === '/preview' || location.pathname.startsWith('/preview/'))
  const [demo, setDemo] = useState<typeof import('./demo') | null>(null)
  useEffect(() => {
    if (!previewEnabled || !preview) return
    let active = true
    import('./demo').then(data => { if (active) setDemo(data) })
    return () => { active = false }
  }, [preview])
  const site = useApi<Site>(preview ? null : '/site')
  const categories = useApi<Taxonomy[]>(preview ? null : '/categories')
  const tags = useApi<Taxonomy[]>(preview ? null : '/tags')
  const [authenticated, setAuthenticated] = useState(!!session.get())
  const forget = () => { session.clear(); setAuthenticated(false) }
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('kuronya-theme')
    return saved === 'dark' || saved === 'light' ? saved : 'system'
  })
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => { document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme }
    update(); media.addEventListener('change', update)
    localStorage.setItem('kuronya-theme', theme)
    return () => media.removeEventListener('change', update)
  }, [theme])
  useEffect(() => {
    const expire = () => { session.clear(); setAuthenticated(false) }
    window.addEventListener('session-expired', expire)
    if (session.get()) api('/auth/me').catch(() => {})
    return () => window.removeEventListener('session-expired', expire)
  }, [])
  useEffect(() => { window.scrollTo({ top: 0 }); }, [location.pathname])
  useEffect(() => {
    const handler = (event: Event) => setTheme((event as CustomEvent<string>).detail)
    window.addEventListener('change-theme', handler)
    return () => window.removeEventListener('change-theme', handler)
  }, [])
  const refresh = () => { site.reload(); categories.reload(); tags.reload() }
  return <BlogContext.Provider value={{
    site: preview ? demo?.demoSite || defaultSite : site.data || defaultSite,
    categories: preview ? demo?.demoCategories || [] : categories.data || [], tags: preview ? demo?.demoTags || [] : tags.data || [],
    preview, previewPosts: demo?.demoPosts || [], previewLoading: preview && !demo, refresh, metadataError: site.error || categories.error || tags.error,
    authenticated, authenticate: token => { session.set(token); setAuthenticated(true) }, forget,
  }}><Outlet/></BlogContext.Provider>
}
