import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Clock3, Hash, Menu, MessageCircle, Monitor, Moon, Search, Send, Sparkles, Sun, X } from 'lucide-react'
import { useBlog } from './App'
import { api, json, messageOf, useApi } from './api'
import { CopyLink, dateLabel, ErrorState, Field, Markdown, markdownHtml, Modal, Notice, Pager, RenderedMarkdown, Spinner, useCodeHighlight } from './components'
import { aboutIntroduction, ReaderPage } from './reader-details'
import type { Comment, Post, PostPage, PostSummary } from './types'

export function useTitle(title: string) {
  const { site } = useBlog()
  useEffect(() => { document.title = title ? `${title} · ${site.title}` : site.title }, [title, site.title])
}
export function ThemeControl() {
  const [theme, setTheme] = useState(() => localStorage.getItem('kuronya-theme') || 'system')
  const choices = [{ value: 'light', label: '浅色', icon: Sun }, { value: 'system', label: '跟随系统', icon: Monitor }, { value: 'dark', label: '深色', icon: Moon }]
  return <details className="theme-control"><summary className="icon-button" aria-label="切换主题"><Sun size={18}/></summary><div className="theme-options">{choices.map(({ value, label, icon: Icon }) => <button key={value} aria-pressed={theme === value} onClick={e => { setTheme(value); window.dispatchEvent(new CustomEvent('change-theme', { detail: value })); e.currentTarget.closest('details')?.removeAttribute('open') }}><Icon size={16}/>{label}{theme === value && <Check size={14}/>}</button>)}</div></details>
}
export function PublicLayout() {
  const { site, preview } = useBlog()
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const prefix = preview ? '/preview' : ''
  useEffect(() => { setMobileOpen(false); setSearchOpen(false) }, [location.pathname, location.search])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(v => !v) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  const links = <><NavLink to={prefix || '/'} end>首页</NavLink><NavLink to={`${prefix}/articles`}>文章</NavLink><NavLink to={`${prefix}/archive`}>归档</NavLink><NavLink to={`${prefix}/about`}>关于</NavLink></>
  return <div className="personal-blog">
    <a className="skip-link" href="#main">跳到正文</a>
    {preview && <div className="preview-banner"><Sparkles size={14}/><span>设计预览 · 文章和分类为示例内容</span><Link to="/">查看真实博客 <ArrowUpRight size={13}/></Link></div>}
    <header className="site-header"><div className="header-inner"><Link className="brand" to={prefix || '/'} aria-label={`${site.author} 首页`}><span className="brand-initial">{site.author.slice(0, 1).toUpperCase()}</span><span className="brand-caption">个人笔记 / NOTES</span></Link><nav className="desktop-nav" aria-label="主导航">{links}</nav><div className="header-tools"><button className="search-trigger icon-button" onClick={() => setSearchOpen(true)} aria-label="搜索文章"><Search size={18}/></button><ThemeControl/><button className="icon-button mobile-toggle" onClick={() => setMobileOpen(v => !v)} aria-label={mobileOpen ? '关闭导航' : '打开导航'} aria-expanded={mobileOpen}>{mobileOpen ? <X size={22}/> : <Menu size={22}/>}</button></div></div>{mobileOpen && <nav className="mobile-nav" aria-label="手机导航">{links}</nav>}</header>
    <main id="main"><ReaderPage key={location.pathname}><Outlet/></ReaderPage></main>
    <footer className="site-footer journal-footer"><div className="footer-bottom"><span>© {new Date().getFullYear()} {site.author}</span><div className="footer-links"><Link to={`${prefix}/about`}>关于</Link><a href="#main">回到顶部</a><Link to="/admin">管理</Link></div></div></footer>
    {searchOpen && <Modal title="找一篇文章" close={() => setSearchOpen(false)}><form className="search-form" onSubmit={e => { e.preventDefault(); navigate(`${prefix}/articles${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`); setSearchOpen(false) }}><Search size={22}/><input aria-label="搜索关键词" autoFocus maxLength={100} placeholder="输入标题或正文中的关键词…" value={query} onChange={e => setQuery(e.target.value)}/><button className="icon-button" type="submit" aria-label="开始搜索"><ArrowRight size={22}/></button></form><p className="search-help">按 Enter 搜索 · Esc 关闭</p></Modal>}
  </div>
}
function PostMeta({ post }: { post: PostSummary }) {
  return <div className="post-meta"><span className="category-label">{post.category?.name || '未分类'}</span><span className="meta-dot">·</span><time dateTime={post.published_at || post.created_at}>{dateLabel(post.published_at)}</time></div>
}
function LeadStory({ post }: { post: PostSummary }) {
  const { preview } = useBlog()
  const words = post.category?.slug === 'frontend' ? ['CODE', 'STATE', 'INTERACTION.'] : post.category?.slug === 'notes' ? ['MEASURE.', 'CHANGE.', 'VERIFY.'] : ['STRUCTURE', 'BEFORE', 'DETAILS.']
  const titleBreak = post.title.indexOf('：')
  const title = titleBreak > 0 && titleBreak < 12 ? <>{post.title.slice(0, titleBreak + 1)}<br/>{post.title.slice(titleBreak + 1)}</> : post.title
  return <Link to={`${preview ? '/preview' : ''}/posts/${post.slug}`} className="lead-story"><div className="lead-date">本期记录 · <time dateTime={post.published_at || post.created_at}>{dateLabel(post.published_at)}</time></div><h2 aria-label={post.title}>{title}</h2><div className="editorial-plate" aria-hidden="true"><span>{words.map(word => <span key={word}>{word}</span>)}</span></div>{post.summary && <p>{post.summary}</p>}<span className="lead-read">阅读文章 <ArrowUpRight size={14}/></span></Link>
}
function PostRow({ post, index }: { post: PostSummary; index: number }) {
  const { preview } = useBlog()
  const titleBreak = post.title.indexOf('：')
  const title = titleBreak > 0 && titleBreak < 16 ? <><span className="post-title-part">{post.title.slice(0, titleBreak + 1)}</span><wbr/><span className="post-title-part">{post.title.slice(titleBreak + 1)}</span></> : post.title
  return <Link to={`${preview ? '/preview' : ''}/posts/${post.slug}`} className="post-row journal-post"><div className="post-row-top"><span>{String(index).padStart(2, '0')} / {post.category?.name || '个人笔记'}</span><time className="journal-date" dateTime={post.published_at || post.created_at} title={dateLabel(post.published_at, true)}>{dateLabel(post.published_at).slice(5)}</time></div><div className="post-row-content"><h3 aria-label={post.title}>{title}</h3>{post.summary && <p>{post.summary}</p>}</div><ArrowUpRight className="post-arrow" size={16}/></Link>
}
function usePostList(pageSize: number) {
  const { preview, previewPosts, previewLoading } = useBlog()
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') || '').slice(0, 100)
  const positive = (value: string | null, fallback = 0) => value && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : fallback
  const page = positive(params.get('page'), 1)
  const category = positive(params.get('category_id'))
  const tag = positive(params.get('tag_id'))
  const requestParams = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (q) requestParams.set('q', q)
  if (category) requestParams.set('category_id', String(category))
  if (tag) requestParams.set('tag_id', String(tag))
  const result = useApi<PostPage>(preview ? null : `/posts?${requestParams}`)
  const filtered = preview ? previewPosts.filter(post => (!q || `${post.title}${post.content}`.toLowerCase().includes(q.toLowerCase())) && (!category || post.category?.id === category) && (!tag || post.tags.some(t => t.id === tag))) : []
  const data = preview ? { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, page_size: pageSize } : result.data
  const filter = (key: string, value: string) => { const next = new URLSearchParams(params); next.delete('page'); if (value) next.set(key, value); else next.delete(key); setParams(next) }
  const onPage = (page: number) => { const next = new URLSearchParams(params); next.set('page', String(page)); setParams(next); document.getElementById('writing')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  return { ...result, loading: preview ? previewLoading : result.loading, data, page, q, category, tag, filter, onPage }
}
export function HomePage({ listing = false }: { listing?: boolean }) {
  useTitle(listing ? '全部文章' : '')
  const navigate = useNavigate()
  const { site, categories, tags, preview } = useBlog()
  const introduction = useMemo(() => aboutIntroduction(site.about), [site.about])
  const list = usePostList(8)
  const prefix = preview ? '/preview' : ''
  const filtered = !!(list.q || list.category || list.tag)
  const YearHeading = listing ? 'h2' : 'h3'
  const selectedTag = tags.find(t => t.id === list.tag)
  const lead = !listing && !filtered && list.page === 1 ? list.data?.items[0] : undefined
  const remaining = lead ? list.data!.items.slice(1) : list.data?.items || []
  const years = new Map<number, PostSummary[]>()
  remaining.forEach(post => {
    const year = new Date(post.published_at || post.created_at).getFullYear()
    years.set(year, [...(years.get(year) || []), post])
  })
  return <div className={`page-shell journal-shell ${listing ? 'journal-index' : ''}`}>
    {!listing ? <section className="journal-intro personal-intro"><div className="masthead-kicker"><span>独立写作 / PERSONAL NOTES</span><span>技术 · 实践 · 记录</span></div><div className="intro-name"><h1>{site.author}</h1><span className="masthead-note">NOTES &amp;<br/>PRACTICE</span></div><div className="intro-deck"><p>{site.description || '技术笔记、项目实践与问题记录。'}</p><div className="intro-links"><Link to={`${prefix}/about`}>关于我 <ArrowUpRight size={12}/></Link><Link to={`${prefix}/archive`}>文章归档</Link></div></div>{introduction && <p className="home-about">{introduction}</p>}</section> : <section className="journal-intro listing-intro"><div className="masthead-kicker">WRITING / INDEX</div><div className="listing-title-row"><h1>文章</h1>{list.data && <span className="listing-count">{list.data.total} 篇文章</span>}</div><p>按主题检索笔记与文章。</p></section>}
    <section id="writing" className="writing-section journal-writing">{(!listing || list.q) && <div className="section-heading"><div><h2>{list.q ? `搜索「${list.q}」` : listing ? '全部文章' : '最近更新'}</h2>{!!list.data?.total && <span className="writing-total">{list.data.total} 篇</span>}</div>{!listing && <Link to={`${prefix}/articles`} className="text-link">全部文章 <ArrowRight size={14}/></Link>}</div>}
      <div className="article-list"><div className="journal-filters">{categories.length > 0 && <div className="category-tabs" aria-label="文章分类"><button className={!list.category ? 'selected' : ''} onClick={() => list.filter('category_id', '')}>全部</button>{categories.map(c => <button key={c.id} className={list.category === c.id ? 'selected' : ''} onClick={() => list.filter('category_id', String(c.id))}>{c.name}</button>)}</div>}{tags.length > 0 && <details className="journal-tags"><summary><Hash size={13}/>标签</summary><div className="tag-cloud">{tags.map(tag => <Link to={`${prefix}/articles?tag_id=${tag.id}`} key={tag.id}>#{tag.name}</Link>)}</div></details>}</div>{selectedTag && <div className="active-filter">标签：#{selectedTag.name}<button className="icon-button" aria-label="清除标签筛选" onClick={() => list.filter('tag_id', '')}><X size={14}/></button></div>}
        {list.loading ? <Spinner/> : list.error ? <ErrorState message={list.error} retry={list.reload}/> : !list.data?.items.length ? <div className="journal-empty"><p>{filtered ? '没有找到匹配的文章。' : '还没有发布文章。'}</p>{filtered ? <button className="text-link" onClick={() => navigate(`${prefix}/articles`)}>查看全部文章 <ArrowRight size={14}/></button> : <span>新文章会出现在这里。</span>}</div> : <><div className={`front-page-grid ${lead ? 'has-lead' : ''}`}>
          {lead && <LeadStory post={lead}/>}
          {remaining.length > 0 && <div className="recent-column">{lead && <div className="recent-heading"><h2>继续阅读</h2><span>JOURNAL / INDEX</span></div>}{Array.from(years).map(([year, posts]) => <section className="journal-year" key={year}><YearHeading className="year-heading">{year}</YearHeading><div className="story-grid">{posts.map(post => <PostRow key={post.id} post={post} index={(list.page - 1) * 8 + list.data!.items.indexOf(post) + 1}/>)}</div></section>)}</div>}
          </div>{(list.data.total > 8 || list.page > 1) && <Pager page={list.page} more={list.page * 8 < list.data.total} onPage={list.onPage}/>}</>}
      </div>
    </section>
  </div>
}
export function ArchivePage() {
  useTitle('文章归档')
  const { preview } = useBlog()
  const list = usePostList(100)
  const groups = new Map<string, PostSummary[]>()
  list.data?.items.forEach(post => { const year = new Date(post.published_at || post.created_at).getFullYear().toString(); groups.set(year, [...(groups.get(year) || []), post]) })
  return <div className="page-shell narrow-page"><section className="journal-intro section-intro"><div className="masthead-kicker">ARCHIVE / BY YEAR</div><h1>归档</h1><p>按年份整理的文章。{list.data && ` 共 ${list.data.total} 篇。`}</p></section>{list.loading ? <Spinner/> : list.error ? <ErrorState message={list.error} retry={list.reload}/> : !list.data?.items.length ? <div className="journal-empty"><p>还没有发布文章。</p></div> : <>{Array.from(groups).map(([year, posts]) => <section className="archive-group" key={year}><h2>{year}<span>{posts.length} 篇</span></h2><div>{posts.map(post => <Link className="archive-row" to={`${preview ? '/preview' : ''}/posts/${post.slug}`} key={post.id}><time>{dateLabel(post.published_at).slice(5)}</time><span>{post.title}</span><ArrowUpRight size={18}/></Link>)}</div></section>)}{(list.data!.total > 100 || list.page > 1) && <Pager page={list.page} more={list.page * 100 < list.data!.total} onPage={list.onPage}/>}</>}</div>
}
export function AboutPage() {
  useTitle('关于我')
  const { site, metadataError, refresh } = useBlog()
  const { authenticated } = useBlog()
  return <div className="page-shell narrow-page"><section className="journal-intro section-intro"><div className="masthead-kicker">ABOUT / PROFILE</div><h1>关于 {site.author}</h1><p>{site.description}</p></section>{metadataError ? <ErrorState message={metadataError} retry={refresh}/> : site.about ? <div className="about-content"><Markdown content={site.about}/></div> : <div className="about-default"><p>这里收录我的技术笔记与项目记录。</p><p>通过文章分类和标签可以查找不同主题的内容。</p></div>}{authenticated && <Link to="/admin/settings#about-editor" className="about-edit-link">编辑我的介绍 <ArrowUpRight size={13}/></Link>}</div>
}
function Comments({ post }: { post: Post }) {
  const { preview, site } = useBlog()
  const [page, setPage] = useState(1)
  const [author, setAuthor] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const comments = useApi<Comment[]>(preview ? null : `/posts/${post.slug}/comments?offset=${(page - 1) * 20}&limit=20`)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await api(`/posts/${post.slug}/comments`, json('POST', { author, content })); setContent(''); setNotice('评论已送达，审核通过后会显示在这里。') }
    catch (error) { setError(messageOf(error)) }
    finally { setBusy(false) }
  }
  return <section className="comments-section" id="comments"><div className="section-heading"><div><MessageCircle size={20}/><h2>评论</h2></div></div><p className="muted">欢迎交流。</p>{preview ? <div className="notice neutral">当前为设计预览。正式文章支持提交评论，审核后公开展示。</div> : <>
    {comments.loading ? <Spinner/> : comments.error ? <ErrorState message={comments.error} retry={comments.reload}/> : <>{comments.data?.map(comment => <div className="comment-item" key={comment.id}><div className="comment-avatar">{comment.author[0]}</div><div><div className="comment-meta"><strong>{comment.author}</strong><time>{dateLabel(comment.created_at)}</time></div><p>{comment.content}</p></div></div>)}{!comments.data?.length && <p className="quiet-empty">这里还很安静，你可以留下第一条评论。</p>}{(page > 1 || comments.data?.length === 20) && <Pager page={page} more={comments.data?.length === 20} onPage={setPage}/>}</>}
    {site.comments_enabled ? <form className="comment-form" onSubmit={submit}><Field label="怎么称呼你"><input required maxLength={80} placeholder="你的昵称" autoComplete="nickname" value={author} onChange={e => setAuthor(e.target.value)}/></Field><Field label="你的想法"><textarea required maxLength={2000} rows={4} placeholder="友善交流，让这里成为一个舒服的地方。" value={content} onChange={e => setContent(e.target.value)}/></Field><Notice message={error}/><Notice message={notice} good/><div className="comment-form-bottom"><small>评论审核通过后公开展示。</small><button className="button" disabled={busy || !author.trim() || !content.trim()}>{busy ? '正在发送…' : '发送评论'}<Send size={15}/></button></div></form> : <div className="notice">这篇文章暂时不接受新评论。</div>}
  </>}</section>
}
export function ArticlePage() {
  const { slug } = useParams()
  const { preview, previewPosts, previewLoading } = useBlog()
  const result = useApi<Post>(preview ? null : `/posts/${encodeURIComponent(slug || '')}`)
  const post = preview ? previewPosts.find(p => p.slug === slug) : result.data
  useTitle(post?.title || '文章')
  const highlighted = useCodeHighlight(post?.content || '')
  const rendered = useMemo(() => markdownHtml(post?.content || '', highlighted), [post?.content, highlighted])
  const [progress, setProgress] = useState(0)
  const [activeHeading, setActiveHeading] = useState('')
  useEffect(() => {
    let frame = 0
    const update = () => {
      const distance = document.documentElement.scrollHeight - innerHeight
      setProgress(distance > 0 ? Math.min(100, scrollY / distance * 100) : 100)
      const headings = rendered.headings.filter(heading => heading.level <= 3)
      // At the end of a short article, the last heading cannot reach the top.
      const readingLine = Math.max(170, innerHeight * .4)
      let current = headings[0]?.id || ''
      for (const heading of headings) {
        const element = document.getElementById(heading.id)
        if (element && element.getBoundingClientRect().top <= readingLine) current = heading.id
      }
      if ((document.getElementById('comments')?.getBoundingClientRect().top ?? Infinity) <= readingLine) current = 'comments'
      setActiveHeading(current)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update) }
    schedule(); window.addEventListener('scroll', schedule, { passive: true }); window.addEventListener('resize', schedule)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule) }
  }, [rendered])
  if (previewLoading || result.loading && !preview) return <div className="page-shell"><Spinner/></div>
  if (result.error) return <div className="page-shell narrow-page"><ErrorState message={result.error} retry={result.reload}/><Link className="text-link" to="/articles"><ArrowLeft size={16}/>返回文章列表</Link></div>
  if (!post) return <NotFound/>
  return <><div className="reading-progress" style={{ width: `${progress}%` }}/><div className="page-shell article-shell">
    <Link className="back-link" to={`${preview ? '/preview' : ''}/articles`}><ArrowLeft size={14}/> 返回文章列表</Link>
    <header className="article-header"><h1>{post.title}</h1><div className="article-byline"><PostMeta post={post}/><span>·</span><Clock3 size={13}/><span>{Math.max(1, Math.ceil(post.content.length / 450))} 分钟阅读</span></div></header>
    <div className="article-columns"><div><article><RenderedMarkdown html={rendered.html} identity={post.content} className="prose article-body"/></article><div className="article-end"><div className="tag-cloud">{post.tags.map(t => <Link key={t.id} to={`${preview ? '/preview' : ''}/articles?tag_id=${t.id}`}>#{t.name}</Link>)}</div><CopyLink/></div><Comments post={post}/></div>
    <aside className="article-toc"><details><summary>文章目录</summary><nav aria-label="文章目录">{rendered.headings.filter(h => h.level <= 3).map(h => <a key={h.id} className={h.level > 2 ? 'nested' : ''} aria-current={activeHeading === h.id ? 'location' : undefined} href={`#${encodeURIComponent(h.id)}`}>{h.title}</a>)}{!rendered.headings.length && <span className="muted small-text">从第一行，慢慢读。</span>}<a href="#comments" aria-current={activeHeading === 'comments' ? 'location' : undefined}>评论与想法</a></nav></details></aside></div>
  </div></>
}
export function NotFound() {
  useTitle('页面未找到')
  const { preview } = useBlog()
  return <div className="page-shell not-found"><span className="eyebrow">PAGE / NOT FOUND</span><span className="not-found-number">404</span><h1>页面未找到</h1><p className="muted">页面可能已经移动，或这篇文章还没有发布。</p><Link className="button" to={preview ? '/preview' : '/'}><ArrowLeft size={16}/>回到首页</Link></div>
}
