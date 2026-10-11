import { cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, Copy, LoaderCircle, X } from 'lucide-react'
import { codeHighlightReady, createMarkdownParser, loadCodeHighlight } from './markdown-code'
import DOMPurify from 'dompurify'

export function Spinner() { return <div className="loading" role="status"><LoaderCircle className="spin" size={22}/><span>正在加载…</span></div> }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="empty-state" role="alert"><span className="eyebrow">SOMETHING WENT WRONG</span><h3>暂时没能加载出来</h3><p>{message}</p>{retry && <button className="button secondary" onClick={retry}>重新加载 <ArrowRight size={16}/></button>}</div>
}
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty-state"><span className="eyebrow">NO ENTRIES YET</span><h3>{title}</h3><div className="muted">{children}</div></div>
}
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = useId()
  const control = isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)
    ? cloneElement(children, { id, 'aria-describedby': hint ? `${id}-hint` : undefined }) : children
  return <div className="field"><label htmlFor={id}>{label}</label>{control}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>
}
export function Notice({ message, good = false }: { message: string; good?: boolean }) {
  return message ? <div className={`notice ${good ? 'success' : ''}`} role={good ? 'status' : 'alert'}>{good && <Check size={16}/>} {message}</div> : null
}
export function Pager({ page, more, onPage }: { page: number; more: boolean; onPage: (page: number) => void }) {
  return <div className="pager"><button disabled={page <= 1} onClick={() => onPage(page - 1)}><ArrowLeft size={16}/> 上一页</button><span>第 {page} 页</span><button disabled={!more} onClick={() => onPage(page + 1)}>下一页 <ArrowRight size={16}/></button></div>
}
export function Modal({ title, children, close, className = '' }: { title: string; children: ReactNode; close: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement as HTMLElement | null
    dialog.showModal()
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = oldOverflow; previous?.focus() }
  }, [])
  return <dialog className={`modal ${className}`} ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }}><div className="modal-head"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="关闭弹窗" onClick={close}><X size={20}/></button></div>{children}</dialog>
}
export function Confirm({ title, description, confirm, close, busy = false }: { title: string; description: string; confirm: () => void; close: () => void; busy?: boolean }) {
  return <Modal title={title} close={busy ? () => {} : close}><p className="muted">{description}</p><div className="modal-actions"><button className="button secondary" onClick={close} disabled={busy}>取消</button><button className="button danger" onClick={confirm} disabled={busy}>{busy ? '正在处理…' : '确认删除'}</button></div></Modal>
}
export function markdownHtml(content: string, highlighted = true) {
  const counts: Record<string, number> = {}
  const parser = createMarkdownParser(highlighted)
  const tokens = parser.parse(content, {})
  const headings: { id: string; title: string; level: number }[] = []
  tokens.forEach((token, index) => {
    if (token.type !== 'heading_open') return
    const text = tokens[index + 1]?.children?.filter(t => t.type === 'text' || t.type === 'code_inline').map(t => t.content).join('') || tokens[index + 1]?.content || '章节'
    const base = `section-${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')}`
    counts[base] = (counts[base] || 0) + 1
    const id = `${base}-${counts[base]}`
    token.attrSet('id', id)
    token.attrSet('aria-label', text)
    headings.push({ id, title: text, level: Number(token.tag.slice(1)) })
  })
  parser.renderer.rules.heading_open = (tokens, index, options, _env, renderer) => {
    const token = tokens[index]
    const id = String(token.attrGet('id') || '')
    const label = parser.utils.escapeHtml(String(token.attrGet('aria-label') || '标题'))
    return `${renderer.renderToken(tokens, index, options)}<a class="heading-anchor" href="#${encodeURIComponent(id)}" aria-label="链接到标题：${label}"></a>`
  }
  return { html: DOMPurify.sanitize(parser.renderer.render(tokens, parser.options, {})), headings }
}
export function Markdown({ content }: { content: string }) {
  const highlighted = useCodeHighlight(content)
  const html = useMemo(() => markdownHtml(content, highlighted).html, [content, highlighted])
  return <RenderedMarkdown html={html} identity={content}/>
}
export function RenderedMarkdown({ html, identity, className = 'prose' }: { html: string; identity?: string; className?: string }) {
  const documentKey = identity ?? html
  const root = useRef<HTMLDivElement>(null)
  const timers = useRef(new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>())
  const [feedback, setFeedback] = useState({ html: '', message: '' })
  const [image, setImage] = useState<{ html: string; src: string; alt: string } | null>(null)
  useEffect(() => {
    const pending = timers.current
    return () => { pending.forEach(clearTimeout); pending.clear() }
  }, [html])
  const interact = async (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest<HTMLButtonElement>('button[data-code-copy], button[data-image-zoom]')
    if (!button || !root.current?.contains(button)) return
    if (button.hasAttribute('data-image-zoom')) {
      const img = button.querySelector('img')
      if (img?.getAttribute('src')) setImage({ html: documentKey, src: img.currentSrc || img.src, alt: img.alt })
      return
    }
    const code = button.closest('.code-frame')?.querySelector('pre > code')?.textContent
    if (code === undefined || code === null) return
    clearTimeout(timers.current.get(button)); button.disabled = true
    try {
      await navigator.clipboard.writeText(code)
      if (button.isConnected) { button.textContent = '已复制'; button.dataset.copyStatus = 'success'; setFeedback({ html: documentKey, message: '代码已复制。' }) }
    } catch {
      if (button.isConnected) { button.textContent = '复制失败'; button.dataset.copyStatus = 'error'; setFeedback({ html: documentKey, message: '复制失败，请选中代码手动复制。' }) }
    } finally {
      button.disabled = false
      if (button.isConnected) timers.current.set(button, setTimeout(() => { if (button.isConnected) { button.textContent = '复制'; delete button.dataset.copyStatus } timers.current.delete(button) }, 2500))
    }
  }
  return <><div ref={root} className={className} onClick={interact} dangerouslySetInnerHTML={{ __html: html }}/><span className="sr-only" aria-live="polite" aria-atomic="true">{feedback.html === documentKey ? feedback.message : ''}</span>{image?.html === documentKey && <Modal title="查看图片" className="markdown-image-dialog" close={() => setImage(null)}><img src={image.src} alt={image.alt}/>{image.alt && <p className="image-dialog-caption">{image.alt}</p>}</Modal>}</>
}
export function useCodeHighlight(content: string) {
  const [ready, setReady] = useState(codeHighlightReady)
  const hasCode = /^\s{0,3}(?:`{3,}|~{3,})/m.test(content)
  useEffect(() => {
    if (!hasCode) return
    let active = true
    loadCodeHighlight().then(() => { if (active) setReady(true) }).catch(() => { /* Plain code remains readable if the optional chunk cannot load. */ })
    return () => { active = false }
  }, [hasCode])
  return ready
}
export function CopyLink() {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { if (copied) { const id = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(id) } }, [copied])
  return <><button className="button secondary small" onClick={async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); setFailed(false) } catch { setFailed(true) } }}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? '已复制链接' : '分享文章'}</button>{failed && <small role="alert">请复制浏览器地址栏中的链接。</small>}</>
}
export function dateLabel(value: string | null, full = false) {
  return value ? new Date(value).toLocaleDateString('zh-CN', full ? { year: 'numeric', month: 'long', day: 'numeric' } : { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '.') : '草稿'
}
