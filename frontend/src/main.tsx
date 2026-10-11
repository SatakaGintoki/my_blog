import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import './fonts.css'
import '@fontsource-variable/noto-sans-sc'
import './styles.css'
import './journal.css'
import './markdown.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><React.Suspense fallback={<div className="loading">正在打开页面…</div>}><RouterProvider router={router}/></React.Suspense></React.StrictMode>)
