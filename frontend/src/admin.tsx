import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, Eye, FileText, Hash, LayoutDashboard, LogOut, MessageCircle, PenLine, Plus, Search, Settings, ShieldCheck, Trash2 } from 'lucide-react'
import { useBlog } from './App'
import { api, json, messageOf, useApi } from './api'
import { Confirm, dateLabel, EmptyState, ErrorState, Field, Modal, Notice, Pager, Spinner } from './components'
import { ThemeControl, useTitle } from './public'
import type { Comment, PostPage, PostSummary } from './types'
import './admin.css'

export function LoginPage() {
  useTitle('管理登录')
  const { authenticated, authenticate, site } = useBlog()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const location = useLocation()
  const target = typeof location.state?.from === 'string' && location.state.from.startsWith('/admin') && location.state.from !== '/admin/login' ? location.state.from : '/admin'
  if (authenticated) return <Navigate to={target} replace/>
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true)
    try { const result = await api<{ access_token: string }>('/auth/login', json('POST', { username, password })); authenticate(result.access_token) }
    catch (error) { setError(messageOf(error)) }
    finally { setBusy(false) }
  }
  return <div className="login-page"><header className="login-nav"><Link className="back-link" to="/"><ArrowLeft size={16}/> 回到博客</Link><ThemeControl/></header><div className="login-card"><div className="login-visual"><span className="eyebrow">PERSONAL NOTES / EDITOR</span><strong className="login-masthead">{site.author}</strong><h2>写作与管理</h2><p>整理技术笔记、项目实践与问题记录。</p><div className="login-plate" aria-hidden="true"><span>WRITE.<br/>REVIEW.<br/>PUBLISH.</span></div><small>CONTENT / COMMENTS / SETTINGS</small></div><div className="login-form-wrap"><span className="eyebrow">ACCESS / ADMIN</span><h1>管理登录</h1><p className="muted">登录后管理文章、评论与站点信息。</p><form onSubmit={submit}><Field label="用户名"><input required autoComplete="username" maxLength={80} value={username} onChange={e => setUsername(e.target.value)} placeholder="管理员用户名"/></Field><Field label="密码"><input required type="password" autoComplete="current-password" maxLength={256} value={password} onChange={e => setPassword(e.target.value)} placeholder="输入你的密码"/></Field><Notice message={error}/><button className="button full-width" disabled={busy}>{busy ? '正在登录…' : '进入管理后台'}<ArrowRight size={17}/></button></form><div className="login-hint"><ShieldCheck size={17}/><span>仅管理员可登录。账号由服务器管理员创建。</span></div></div></div></div>
}
export function AdminLayout() {
  const { authenticated, forget, site, metadataError, refresh } = useBlog()
  const location = useLocation()
  const [logoutError, setLogoutError] = useState('')
  const [busy, setBusy] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  if (!authenticated) return <Navigate to="/admin/login" state={{ from: location.pathname + location.search }} replace/>
  const logout = async () => {
    setBusy(true); setLogoutError('')
    try { await api('/auth/logout', { method: 'POST' }); forget() }
    catch (error) { setLogoutError(messageOf(error)) }
    finally { setBusy(false) }
  }
  const links = [{ to: '/admin', label: '概览', icon: LayoutDashboard, end: true }, { to: '/admin/posts', label: '文章', icon: FileText }, { to: '/admin/comments', label: '评论', icon: MessageCircle }, { to: '/admin/taxonomy', label: '分类与标签', icon: Hash }, { to: '/admin/settings', label: '站点设置', icon: Settings }]
  return <div className="admin-app"><aside className="admin-sidebar"><Link className="brand admin-brand" to="/admin"><strong>{site.author}</strong><span>笔记管理 / EDITOR</span></Link><span className="eyebrow sidebar-label">CONTENT / MANAGEMENT</span><nav aria-label="管理导航">{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end}><Icon size={18}/><span>{label}</span></NavLink>)}</nav><Link className="button new-post-button" to="/admin/posts/new"><Plus size={17}/> 写一篇文章</Link><div className="admin-sidebar-bottom"><Link className="text-link" to="/" target="_blank">查看博客 <ArrowUpRight size={15}/></Link><button className="text-link" onClick={() => setLogoutOpen(true)}><LogOut size={15}/>退出所有登录</button></div></aside><div className="admin-main"><header className="admin-topbar"><span>编辑工作台 <small>NOTES / WORKSPACE</small></span><div><ThemeControl/><span className="admin-account">{site.author}</span></div></header><div className="admin-content">{metadataError && <div className="notice" role="alert">分类或站点信息加载失败。<button className="text-link" onClick={refresh}>重新加载</button></div>}<Outlet/></div></div>{logoutOpen && <Modal title="退出所有登录？" close={() => !busy && setLogoutOpen(false)}><p className="muted">请先保存正在编辑的文章。所有设备上的当前登录都会失效，本地草稿备份会保留。</p><Notice message={logoutError}/><div className="modal-actions"><button className="button secondary" onClick={() => setLogoutOpen(false)} disabled={busy}>取消</button><button className="button" onClick={logout} disabled={busy}>{busy ? '正在退出…' : '确认退出'}</button></div></Modal>}</div>
}
export function AdminHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="admin-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>
}
export function Status({ status }: { status: string }) { return <span className={`status-badge ${status}`}>{status === 'published' ? '已发布' : '草稿'}</span> }
export function DashboardPage() {
  useTitle('管理概览')
  const { site } = useBlog()
  const posts = useApi<PostPage>('/admin/posts?page_size=5')
  const drafts = useApi<PostPage>('/admin/posts?status=draft&page_size=1')
  const published = useApi<PostPage>('/admin/posts?status=published&page_size=1')
  const comments = useApi<Comment[]>('/admin/comments?approved=false&limit=100')
  const loading = posts.loading || drafts.loading || published.loading || comments.loading
  const error = posts.error || drafts.error || published.error || comments.error
  const cards = [{ label: '已发布文章', value: published.data?.total, icon: BookOpen, to: '/admin/posts?status=published' }, { label: '草稿文章', value: drafts.data?.total, icon: PenLine, to: '/admin/posts?status=draft' }, { label: '待审核评论', value: comments.data ? `${comments.data.length}${comments.data.length === 100 ? '+' : ''}` : undefined, icon: MessageCircle, to: '/admin/comments' }]
  return <><AdminHeading eyebrow="OVERVIEW / DASHBOARD" title={`欢迎回来，${site.author}。`} description="管理已发布文章、草稿与待审核评论。" action={<Link className="button" to="/admin/posts/new"><Plus size={17}/>写一篇文章</Link>}/>{error ? <ErrorState message={error} retry={() => { posts.reload(); drafts.reload(); published.reload(); comments.reload() }}/> : <div className="stat-grid">{cards.map(({ label, value, icon: Icon, to }) => <Link className="stat-card" to={to} key={label}><div><span>{label}</span><Icon size={20}/></div><strong>{loading ? '—' : value ?? '—'}</strong><span className="text-link">查看详情 <ArrowUpRight size={15}/></span></Link>)}</div>}<section className="panel"><div className="panel-heading"><h2>最近的文章</h2><Link className="text-link" to="/admin/posts">管理全部 <ArrowRight size={16}/></Link></div>{posts.loading ? <Spinner/> : posts.error ? <Notice message={posts.error}/> : !posts.data?.items.length ? <EmptyState title="写下你的第一篇文章"><p>从一个想法开始，草稿可以慢慢完善。</p><Link className="text-link" to="/admin/posts/new">开始写作 <ArrowRight size={16}/></Link></EmptyState> : posts.data.items.map(post => <Link className="dashboard-post" key={post.id} to={`/admin/posts/${post.id}`}><div><h3>{post.title}</h3><span>{dateLabel(post.updated_at)} · {post.category?.name || '未分类'}</span></div><Status status={post.status}/><ArrowUpRight size={17}/></Link>)}</section><div className="writing-tip"><PenLine size={20}/><div><strong>写作提示</strong><p>保存草稿后可继续编辑，发布前可在编辑器中预览正文。</p></div></div></>
}
export function AdminPostsPage() {
  useTitle('文章管理')
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const status = ['draft', 'published'].includes(params.get('status') || '') ? params.get('status')! : ''
  const q = (params.get('q') || '').slice(0, 100)
  const [search, setSearch] = useState(q)
  const [deleting, setDeleting] = useState<PostSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const result = useApi<PostPage>(`/admin/posts?page=${page}&page_size=12${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
  const filter = (key: string, value: string) => { const next = new URLSearchParams(params); next.delete('page'); if (value) next.set(key, value); else next.delete(key); setParams(next) }
  const remove = async () => {
    if (!deleting) return
    setBusy(true); setError('')
    try { await api(`/admin/posts/${deleting.id}`, { method: 'DELETE' }); setDeleting(null); if (result.data?.items.length === 1 && page > 1) filter('page', String(page - 1)); else result.reload() }
    catch (error) { setError(messageOf(error)); setDeleting(null) }
    finally { setBusy(false) }
  }
  return <><AdminHeading eyebrow="WRITING / ARTICLES" title="你的文章" description="检索、编辑与管理所有文章。" action={<Link className="button" to="/admin/posts/new"><Plus size={17}/>新建文章</Link>}/><div className="admin-filter-bar"><div className="category-tabs">{[['', '全部'], ['published', '已发布'], ['draft', '草稿']].map(([value, label]) => <button key={value} className={status === value ? 'selected' : ''} onClick={() => filter('status', value)}>{label}</button>)}</div><form className="inline-search" onSubmit={e => { e.preventDefault(); filter('q', search.trim()) }}><Search size={16}/><input aria-label="搜索管理文章" placeholder="搜索文章…" value={search} maxLength={100} onChange={e => setSearch(e.target.value)}/><button type="submit" className="icon-button" aria-label="执行文章搜索"><ArrowRight size={16}/></button></form></div><Notice message={error}/><section className="panel">{result.loading ? <Spinner/> : result.error ? <ErrorState message={result.error} retry={result.reload}/> : !result.data?.items.length ? <EmptyState title="这里还没有文章"><Link className="text-link" to="/admin/posts/new">写一篇新的 <ArrowRight size={16}/></Link></EmptyState> : <><div className="table-scroll"><table className="post-table"><thead><tr><th>文章</th><th>状态</th><th>更新日期</th><th>操作</th></tr></thead><tbody>{result.data.items.map(post => <tr key={post.id}><td><Link className="table-title" to={`/admin/posts/${post.id}`}>{post.title}</Link><small>{post.category?.name || '未分类'} · /{post.slug}</small></td><td><Status status={post.status}/></td><td className="table-date">{dateLabel(post.updated_at)}</td><td><div className="row-actions"><Link className="icon-button" aria-label={`编辑 ${post.title}`} to={`/admin/posts/${post.id}`}><PenLine size={16}/></Link>{post.status === 'published' && <Link className="icon-button" aria-label={`阅读 ${post.title}`} to={`/posts/${post.slug}`} target="_blank"><Eye size={16}/></Link>}<button className="icon-button danger-text" aria-label={`删除 ${post.title}`} onClick={() => setDeleting(post)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div><Pager page={page} more={page * 12 < result.data.total} onPage={next => { const value = new URLSearchParams(params); value.set('page', String(next)); setParams(value) }}/></>}</section>{deleting && <Confirm title="删除这篇文章？" description={`「${deleting.title}」以及它的所有评论都会被删除，此操作无法撤销。`} close={() => setDeleting(null)} busy={busy} confirm={remove}/>}</>
}
export function AdminCommentsPage() {
  useTitle('评论审核')
  const [filter, setFilter] = useState('pending')
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState<Comment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const result = useApi<Comment[]>(`/admin/comments?offset=${(page - 1) * 20}&limit=20${filter !== 'all' ? `&approved=${filter === 'approved'}` : ''}`)
  const act = async (comment: Comment, remove = false) => {
    setBusy(true); setError(''); setNotice('')
    try { await api(`/admin/comments/${comment.id}`, remove ? { method: 'DELETE' } : json('PATCH', { approved: !comment.approved })); setNotice(remove ? '评论已删除。' : comment.approved ? '评论已撤回，读者将不再看到它。' : '评论已通过审核。'); setDeleting(null); if (result.data?.length === 1 && page > 1) setPage(page - 1); else result.reload() }
    catch (error) { setError(messageOf(error)); setDeleting(null) }
    finally { setBusy(false) }
  }
  return <><AdminHeading eyebrow="COMMUNITY / COMMENTS" title="评论与交流" description="查看访客评论，审核后公开展示。"/><div className="category-tabs admin-tabs">{[['pending', '待审核'], ['approved', '已通过'], ['all', '全部评论']].map(([value, label]) => <button className={filter === value ? 'selected' : ''} key={value} onClick={() => { setFilter(value); setPage(1) }}>{label}</button>)}</div><Notice message={error}/><Notice message={notice} good/><section className="panel">{result.loading ? <Spinner/> : result.error ? <ErrorState message={result.error} retry={result.reload}/> : !result.data?.length ? <EmptyState title={filter === 'pending' ? '所有评论都已处理' : '这里还没有评论'}><p>新的交流，会随着文章慢慢到来。</p></EmptyState> : <>{result.data.map(comment => <div className="moderation-item" key={comment.id}><div className="moderation-heading"><span className="comment-avatar">{comment.author[0]}</span><div><strong>{comment.author}</strong><small>{dateLabel(comment.created_at)} · <Link to={`/admin/posts/${comment.post_id}`}>文章 #{comment.post_id} <ArrowUpRight size={12}/></Link></small></div><span className={`status-badge ${comment.approved ? 'published' : 'draft'}`}>{comment.approved ? '已通过' : '待审核'}</span></div><p>{comment.content}</p><div className="moderation-actions"><button className="button secondary small" disabled={busy} onClick={() => act(comment)}>{comment.approved ? <Eye size={15}/> : <Check size={15}/>} {comment.approved ? '撤回审核' : '通过审核'}</button><button className="text-link danger-text" disabled={busy} onClick={() => setDeleting(comment)}><Trash2 size={15}/>删除</button></div></div>)}<Pager page={page} more={result.data.length === 20} onPage={setPage}/></>}</section>{deleting && <Confirm title="删除这条评论？" description={`来自「${deleting.author}」的评论将被永久删除。`} close={() => setDeleting(null)} confirm={() => act(deleting, true)} busy={busy}/>}</>
}
