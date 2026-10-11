import { useCallback, useEffect, useState } from 'react'

const tokenKey = 'kuronya-session'
export const session = {
  get: () => sessionStorage.getItem(tokenKey),
  set: (token: string) => sessionStorage.setItem(tokenKey, token),
  clear: () => sessionStorage.removeItem(tokenKey),
}
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = session.get()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try { response = await fetch(`/api/v1${path}`, { ...options, headers }) }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('暂时无法连接服务器，请稍后重试。', 0)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    let message = typeof body.detail === 'string' ? body.detail : '请求失败，请检查填写的内容。'
    if (Array.isArray(body.detail)) message = body.detail.map((item: { loc: string[]; msg: string }) => `${item.loc.slice(1).join('.')}: ${item.msg}`).join('；')
    if (response.status === 401 && path !== '/auth/login') {
      session.clear()
      window.dispatchEvent(new Event('session-expired'))
    }
    throw new ApiError(message, response.status)
  }
  return response.status === 204 ? undefined as T : response.json()
}
export const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })
export const messageOf = (error: unknown) => error instanceof Error ? error.message : '操作失败，请稍后重试。'
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!!path)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion(v => v + 1), [])
  useEffect(() => {
    if (!path) { setData(null); setLoading(false); setError(''); return }
    const controller = new AbortController()
    setLoading(true); setData(null); setError('')
    api<T>(path, { signal: controller.signal }).then(value => {
      setData(value); setLoading(false)
    }).catch(error => {
      if (controller.signal.aborted) return
      setError(messageOf(error)); setLoading(false)
    })
    return () => controller.abort()
  }, [path, version])
  return { data, loading, error, reload }
}
