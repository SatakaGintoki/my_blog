import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Download, ImagePlus, Save, Settings, ShieldCheck } from 'lucide-react'
import { useBlog } from './App'
import { api, ApiError, json, messageOf, useApi } from './api'
import { ErrorState, Field, Markdown, Modal, Notice, Spinner } from './components'
import { useTitle } from './public'
import { Status } from './admin'
import type { Post, PostInput } from './types'

const blankPost: PostInput = { title: '', slug: '', summary: '', content: '', status: 'draft', category_id: null, tag_ids: [] }
const inputFrom = (post: Post): PostInput => ({ title: post.title, slug: post.slug, summary: post.summary, content: post.content, status: post.status, category_id: post.category?.id || null, tag_ids: post.tags.map(t => t.id), expected_updated_at: post.updated_at })
const fingerprint = (form: PostInput) => JSON.stringify(form)
interface LocalDraft { form: PostInput; savedAt: string }
export function EditorPage() {
  const { id } = useParams()
  return <Editor key={id || 'new'} id={id}/>
}
function Editor({ id }: { id?: string }) {
  useTitle(id ? '编辑文章' : '新建文章')
  const { categories, tags } = useBlog()
  const navigate = useNavigate()
  const result = useApi<Post>(id ? `/admin/posts/${id}` : null)
  const [form, setForm] = useState<PostInput>({ ...blankPost })
  const [baseline, setBaseline] = useState(fingerprint(blankPost))
  const [ready, setReady] = useState(!id)
  const [restore, setRestore] = useState<LocalDraft | null>(null)
  const [mode, setMode] = useState('split')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [backupStatus, setBackupStatus] = useState('')
  const [conflict, setConflict] = useState(false)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const initialized = useRef(false)
  const allowLeave = useRef(false)
  const saving = useRef(false)
  const dirty = ready && fingerprint(form) !== baseline
  const valid = !!form.title.trim() && !!form.content.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)
  const backupKey = `kuronya-draft-${id || 'new'}`
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !allowLeave.current && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search))
  useEffect(() => {
    if (initialized.current || (id && !result.data)) return
    initialized.current = true
    const initial = result.data ? inputFrom(result.data) : { ...blankPost }
    setForm(initial); setBaseline(fingerprint(initial)); setReady(true)
    try {
      const saved = JSON.parse(localStorage.getItem(backupKey) || 'null') as LocalDraft | null
      if (saved?.form && typeof saved.form.content === 'string' && typeof saved.form.title === 'string' && Array.isArray(saved.form.tag_ids) && fingerprint(saved.form) !== fingerprint(initial)) setRestore(saved)
    } catch { /* Invalid or unavailable local backup is ignored. */ }
  }, [result.data, id, backupKey])
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => {
      try { localStorage.setItem(backupKey, JSON.stringify({ form, savedAt: new Date().toISOString() })); setBackupStatus('本地备份已更新') }
      catch { setBackupStatus('本地备份不可用，请及时保存到服务器') }
    }, 600)
    return () => clearTimeout(timer)
  }, [form, dirty, backupKey])
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  const update = <K extends keyof PostInput>(key: K, value: PostInput[K]) => { setForm(previous => ({ ...previous, [key]: value })); setNotice('') }
  const save = useCallback(async (status: 'draft' | 'published') => {
    if (busy || uploading || saving.current) return
    saving.current = true
    setError(''); setNotice(''); setBusy(true); setConflict(false)
    try {
      const saved = await api<Post>(id ? `/admin/posts/${id}` : '/admin/posts', json(id ? 'PUT' : 'POST', { ...form, status }))
      const next = inputFrom(saved)
      setForm(next); setBaseline(fingerprint(next)); setNotice(status === 'published' ? '文章已发布，读者现在可以看到它了。' : '草稿已保存。'); setBackupStatus('')
      try { localStorage.removeItem(backupKey) } catch { /* The server save still succeeded. */ }
      if (!id) { allowLeave.current = true; navigate(`/admin/posts/${saved.id}`, { replace: true }) }
    } catch (error) { setError(messageOf(error)); setConflict(error instanceof ApiError && error.status === 409) }
    finally { saving.current = false; setBusy(false) }
  }, [busy, uploading, form, id, backupKey, navigate])
  useEffect(() => {
    const keyboardSave = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 's' || event.isComposing) return
      event.preventDefault()
      if (event.repeat || !ready || restore || blocker.state === 'blocked' || busy || uploading) return
      if (!valid) { setError('请先填写文章标题、有效的文章地址和正文。'); return }
      void save(form.status)
    }
    window.addEventListener('keydown', keyboardSave)
    return () => window.removeEventListener('keydown', keyboardSave)
  }, [save, form.status, ready, restore, blocker.state, busy, uploading, valid])
  const upload = async (file?: File) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('图片不能超过 5 MB。'); return }
    setUploading(true); setError('')
    const position = textarea.current?.selectionStart ?? form.content.length
    const body = new FormData(); body.append('file', file)
    try {
      const uploaded = await api<{ url: string }>('/admin/uploads', { method: 'POST', body })
      const insert = `\n![图片说明](${uploaded.url})\n`
      setForm(previous => ({ ...previous, content: previous.content.slice(0, position) + insert + previous.content.slice(position) }))
      setNotice('图片已上传并插入正文，请修改图片说明。')
    } catch (error) { setError(messageOf(error)) }
    finally { setUploading(false) }
  }
  const download = () => {
    const blob = new Blob([`# ${form.title}\n\n${form.content}`], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${form.slug || 'untitled'}.md`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (result.loading && id) return <Spinner/>
  if (result.error) return <ErrorState message={result.error} retry={result.reload}/>
  return <><div className="editor-heading"><Link className="back-link" to="/admin/posts"><ArrowLeft size={16}/>文章列表</Link><div><span className="save-state">{dirty ? backupStatus || '有未保存的修改' : id ? '已与服务器同步' : '尚未保存'}</span><Status status={form.status}/></div></div><div className="admin-heading editor-main-heading"><div><span className="eyebrow">WRITING / EDITOR</span><h1>{id ? '打磨你的文字' : '写下一个新想法'}</h1></div><div className="editor-save-actions"><span className="editor-save-hint">Ctrl / ⌘ + S 保存</span><button aria-keyshortcuts="Control+s Meta+s" title="保存文章（Ctrl / ⌘ + S）" className="button secondary" disabled={busy || uploading || !valid} onClick={() => save(form.status)}><Save size={16}/>{form.status === 'published' ? '保存修改' : '保存草稿'}</button><button className="button" disabled={busy || uploading || !valid} onClick={() => save(form.status === 'published' ? 'draft' : 'published')}>{busy ? '正在保存…' : form.status === 'published' ? '撤回为草稿' : '发布文章'}<ArrowUpRight size={16}/></button></div></div><Notice message={error}/><Notice message={notice} good/>{conflict && <div className="conflict-actions"><button className="button secondary small" onClick={download}><Download size={15}/>下载本地 Markdown</button><p className="muted small-text">请先备份，再重新打开文章并合并修改。当前内容不会自动覆盖服务器版本。</p></div>}
    <div className="editor-grid"><section className="panel editor-panel"><Field label="文章标题"><input className="title-input" maxLength={200} value={form.title} onChange={e => update('title', e.target.value)} placeholder="一个值得被写下的标题…"/></Field><Field label="摘要" hint="出现在文章列表，最多 500 字。"><textarea rows={2} maxLength={500} value={form.summary} onChange={e => update('summary', e.target.value)} placeholder="用一两句话，告诉读者这篇文章在讲什么。"/></Field><div className="editor-toolbar"><div className="editor-modes">{[['edit', '编辑'], ['split', '分栏'], ['preview', '预览']].map(([value, label]) => <button key={value} className={mode === value ? 'selected' : ''} onClick={() => setMode(value)}>{label}</button>)}</div><label className={`upload-button ${uploading ? 'disabled' : ''}`}><ImagePlus size={16}/><span>{uploading ? '上传中…' : '插入图片'}</span><input type="file" aria-label="上传图片" accept="image/jpeg,image/png,image/webp" disabled={uploading || busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }}/></label></div><div className={`markdown-editor mode-${mode}`}>{mode !== 'preview' && <textarea ref={textarea} className="markdown-source" aria-label="Markdown 正文" maxLength={200000} placeholder={'从这里开始…\n\n支持 Markdown：\n## 二级标题\n**重点文字**\n- 列表'} value={form.content} onChange={e => update('content', e.target.value)}/>} {mode !== 'edit' && <div className="markdown-preview">{form.content ? <Markdown content={form.content}/> : <p className="muted">文字会在这里，变成读者看到的样子。</p>}</div>}</div><div className="editor-bottom"><span>Markdown</span><span>{form.content.length.toLocaleString()} 字符</span><button className="text-link" onClick={download}><Download size={14}/>导出文章</button></div></section><aside className="editor-settings"><section className="panel"><div className="panel-heading"><h2>文章设置</h2><Settings size={16}/></div><Field label="文章地址 slug" hint="使用小写字母、数字和连字符，例如 hello-world。"><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={160} value={form.slug} onChange={e => update('slug', e.target.value)} placeholder="a-new-idea"/></Field><Field label="分类"><select value={form.category_id || ''} onChange={e => update('category_id', e.target.value ? Number(e.target.value) : null)}><option value="">未分类</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><div className="field"><span>标签</span><div className="tag-picker">{tags.map(tag => <label key={tag.id}><input type="checkbox" checked={form.tag_ids.includes(tag.id)} disabled={!form.tag_ids.includes(tag.id) && form.tag_ids.length >= 30} onChange={e => update('tag_ids', e.target.checked ? [...form.tag_ids, tag.id] : form.tag_ids.filter(i => i !== tag.id))}/>{tag.name}</label>)}</div>{!tags.length && <small>还没有标签。可以到「分类与标签」创建。</small>}</div>{result.data?.status === 'published' && <Link className="text-link" to={`/posts/${result.data.slug}`} target="_blank">查看已发布版本 <ArrowUpRight size={15}/></Link>}</section><div className="editor-help"><ShieldCheck size={20}/><strong>给文字留一份备份</strong><p>修改后会在当前浏览器备份草稿。发布或保存到服务器后，备份会清除。</p><small>本地备份仅保存在这台设备，请在共享电脑上谨慎使用。</small></div></aside></div>
    {restore && <Modal title="发现一份本地草稿" close={() => setRestore(null)}><p className="muted">这台设备有一份未保存的内容。恢复后可以继续编辑；旧版本仍会接受服务器的冲突检查。</p><div className="modal-actions"><button className="button secondary" onClick={() => { try { localStorage.removeItem(backupKey) } catch {} setRestore(null) }}>使用服务器版本</button><button className="button" onClick={() => { setForm(restore.form); setRestore(null) }}>恢复本地草稿</button></div></Modal>}
    {blocker.state === 'blocked' && <Modal title="文章还没有保存" close={() => blocker.reset()}><p className="muted">离开后，尚未保存到服务器的修改不会发布。你可以先保存，或保留一份本地备份再离开。</p><div className="modal-actions"><button className="button secondary" onClick={() => blocker.reset()}>继续编辑</button><button className="button" onClick={() => { try { localStorage.setItem(backupKey, JSON.stringify({ form, savedAt: new Date().toISOString() })); blocker.proceed() } catch { setError('本地备份失败，请下载 Markdown 后再离开。'); blocker.reset() } }}>备份并离开</button></div></Modal>}
  </>
}
