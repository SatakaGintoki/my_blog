import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { markdownHtml } from './components'

export function aboutIntroduction(content: string) {
  if (!content.trim()) return ''
  const document = new DOMParser().parseFromString(markdownHtml(content).html, 'text/html')
  const paragraph = document.querySelector('p')?.textContent?.trim() || ''
  return paragraph.length > 180 ? `${paragraph.slice(0, 180)}…` : paragraph
}

export function ReaderPage({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = root.current
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    if (!container) return
    let intersection: IntersectionObserver | undefined
    let mutations: MutationObserver | undefined
    const start = () => {
      intersection?.disconnect(); mutations?.disconnect()
      if (media.matches) return
      const registered = new WeakSet<Element>()
      intersection = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          const element = entry.target as HTMLElement
          element.dataset.readerEntered = 'true'
          intersection?.unobserve(entry.target)
        })
      }, { threshold: .08, rootMargin: '0px 0px -20px 0px' })
      const register = () => container.querySelectorAll('.masthead-kicker, .intro-name, .intro-deck, .personal-intro > p, .lead-story, .journal-post, .archive-group, .not-found, .article-header, .article-body > *, .about-content .prose > *').forEach(element => {
        if (registered.has(element)) return
        registered.add(element); intersection?.observe(element)
      })
      register()
      mutations = new MutationObserver(register)
      mutations.observe(container, { childList: true, subtree: true })
    }
    start(); media.addEventListener('change', start)
    return () => { intersection?.disconnect(); mutations?.disconnect(); media.removeEventListener('change', start) }
  }, [])
  return <div className="reader-page" ref={root}>{children}</div>
}
