import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, PenLine, Plus, Save, Settings, ShieldCheck, Trash2 } from 'lucide-react'
import { useBlog } from './App'
import { api, json, messageOf } from './api'
import { Confirm, EmptyState, Field, Markdown, Modal, Notice } from './components'
import { aboutIntroduction } from './reader-details'
import { useTitle } from './public'
import { AdminHeading } from './admin'
import type { Site, Taxonomy } from './types'

export function TaxonomyPage() {
  useTitle('分类与标签')
  const { categories, tags, refresh } = useBlog()
  const [editing, setEditing] = useState<{ type: string; item?: Taxonomy } | null>(null)
  const [deleting, setDeleting] = useState<{ type: string; item: Taxonomy } | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [modalError, setModalError] = useState('')
  const open = (type: string, item?: Taxonomy) => { setEditing({ type, item }); setName(item?.name || ''); setSlug(item?.slug || ''); setModalError('') }
  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!editing) return
    setBusy(true); setModalError('')
    try { await api(`/admin/${editing.type}${editing.item ? `/${editing.item.id}` : ''}`, json(editing.item ? 'PUT' : 'POST', { name, slug })); setEditing(null); refresh() }
    catch (error) { setModalError(messageOf(error)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!deleting) return
    setBusy(true); setError('')
    try { await api(`/admin/${deleting.type}/${deleting.item.id}`, { method: 'DELETE' }); setDeleting(null); refresh() }
    catch (error) { setError(messageOf(error)); setDeleting(null) }
    finally { setBusy(false) }
  }
  return <><AdminHeading eyebrow="ORGANIZE / TOPICS" title="分类与标签" description="整理文章分类与标签，便于读者查找。"/><Notice message={error}/><div className="taxonomy-grid">{[{ type: 'categories', title: '分类', data: categories }, { type: 'tags', title: '标签', data: tags }].map(({ type, title, data }) => <section className="panel" key={type}><div className="panel-heading"><h2>{title}<span className="count-pill">{data.length}</span></h2><button className="text-link" onClick={() => open(type)}><Plus size={16}/>新建{title}</button></div>{!data.length ? <EmptyState title={`还没有${title}`}/> : data.map(item => <div className="taxonomy-row" key={item.id}><div><strong>{type === 'tags' && '#'}{item.name}</strong><small>/{item.slug}</small></div><button className="icon-button" aria-label={`编辑${item.name}`} onClick={() => open(type, item)}><PenLine size={16}/></button><button className="icon-button danger-text" aria-label={`删除${item.name}`} onClick={() => setDeleting({ type, item })}><Trash2 size={16}/></button></div>)}</section>)}</div>{editing && <Modal title={`${editing.item ? '编辑' : '新建'}${editing.type === 'categories' ? '分类' : '标签'}`} close={() => !busy && setEditing(null)}><form onSubmit={save}><Field label="名称"><input required autoFocus maxLength={80} value={name} onChange={e => setName(e.target.value)}/></Field><Field label="slug" hint="小写字母、数字和连字符，例如 daily-life。"><input required maxLength={120} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={e => setSlug(e.target.value)}/></Field><Notice message={modalError}/><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setEditing(null)} disabled={busy}>取消</button><button className="button" disabled={busy}>{busy ? '保存中…' : '保存'}</button></div></form></Modal>}{deleting && <Confirm title={`删除「${deleting.item.name}」？`} description={deleting.type === 'categories' ? '文章会保留，所属分类会变为「未分类」。' : '文章会保留，关联的这个标签会被移除。'} close={() => setDeleting(null)} confirm={remove} busy={busy}/>}</>
}
export function SettingsPage() {
  useTitle('站点设置')
  const location = useLocation()
  const { site, refresh, forget } = useBlog()
  const [form, setForm] = useState<Site>({ ...site })
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const introduction = useMemo(() => aboutIntroduction(form.about), [form.about])
  useEffect(() => {
    if (location.hash !== '#about-editor') return
    const frame = requestAnimationFrame(() => {
      const anchor = document.getElementById('about-editor')
      anchor?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      anchor?.nextElementSibling?.querySelector('textarea')?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.hash])
  useEffect(() => { if (!dirty) setForm({ ...site }) }, [site, dirty])
  const update = <K extends keyof Site>(key: K, value: Site[K]) => { setForm(previous => ({ ...previous, [key]: value })); setDirty(true); setNotice('') }
  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await api('/admin/site', json('PUT', form)); refresh(); setDirty(false); setNotice('站点信息已保存。') }
    catch (error) { setError(messageOf(error)) }
    finally { setBusy(false) }
  }
  const changePassword = async (e: FormEvent) => {
    e.preventDefault(); setPasswordError('')
    if (newPassword !== confirmation) { setPasswordError('两次输入的新密码不一致。'); return }
    if (!newPassword.trim()) { setPasswordError('新密码不能全为空格。'); return }
    setBusy(true)
    try { await api('/auth/password', json('PUT', { old_password: oldPassword, new_password: newPassword })); forget() }
    catch (error) { setPasswordError(messageOf(error)) }
    finally { setBusy(false) }
  }
  return <><AdminHeading eyebrow="PROFILE / SETTINGS" title="站点设置" description="管理个人介绍、博客信息与账号。"/><div className="settings-grid"><form className="panel" onSubmit={save}><div className="panel-heading"><h2>个人介绍与博客</h2><Settings size={18}/></div><Field label="博客名称"><input required maxLength={120} value={form.title} onChange={e => update('title', e.target.value)}/></Field><Field label="你的昵称"><input required maxLength={80} value={form.author} onChange={e => update('author', e.target.value)}/></Field><Field label="一句话介绍" hint="显示在首页名字下，以及关于页的标题下。"><textarea rows={2} maxLength={500} value={form.description} onChange={e => update('description', e.target.value)}/></Field><div id="about-editor" className="about-editor-anchor"/><Field label="关于我" hint="支持 Markdown。首段文字自动显示在首页，完整内容显示在「关于我」页面。"><textarea className="about-source" rows={8} maxLength={20000} value={form.about} onChange={e => update('about', e.target.value)} placeholder="写一点关于你，以及这个博客的故事。"/></Field><label className="switch-row"><div><strong>允许访客评论</strong><p>新评论审核通过后公开展示。</p></div><input type="checkbox" role="switch" checked={form.comments_enabled} onChange={e => update('comments_enabled', e.target.checked)}/></label><Notice message={error}/><Notice message={notice} good/><button className="button" disabled={busy}><Save size={16}/>{busy ? '保存中…' : '保存站点信息'}</button></form><aside className="settings-aside"><section className="panel profile-preview"><div className="panel-heading"><h2>个人介绍预览</h2></div><p className="muted small-text">当前编辑内容的预览，保存后公开显示。</p><div className="profile-preview-name"><h3>{form.author || '你的昵称'}</h3></div><p className="profile-preview-description">{form.description || '一句话介绍会显示在这里。'}</p><p className="profile-preview-about">{introduction || '「关于我」的第一段会显示在这里。'}</p><details className="profile-preview-full"><summary>展开完整关于页预览</summary>{form.about ? <Markdown content={form.about}/> : <p className="muted small-text">写下你的兴趣、常写的主题，或这个博客的故事。</p>}</details><Link className="text-link" to="/about" target="_blank" rel="noopener">查看已保存的关于页 <ArrowRight size={13}/></Link></section><form className="panel password-panel" onSubmit={changePassword}><div className="panel-heading"><h2>账号安全</h2><ShieldCheck size={18}/></div><p className="muted small-text">修改密码后，所有设备需要重新登录。</p><Field label="当前密码"><input type="password" required maxLength={256} autoComplete="current-password" value={oldPassword} onChange={e => setOldPassword(e.target.value)}/></Field><Field label="新密码" hint="至少 12 个字符。"><input type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)}/></Field><Field label="再次输入新密码"><input type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)}/></Field><Notice message={passwordError}/><button className="button secondary" disabled={busy}>更新密码 <ArrowRight size={16}/></button></form></aside></div></>
}
