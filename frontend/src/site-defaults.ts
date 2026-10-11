import type { Site } from './types'

export const defaultSite: Site = {
  title: 'Kuronya 的博客', author: 'Kuronya', description: '技术笔记、项目实践与问题记录。',
  about: '', comments_enabled: true,
}
export const previewEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_PREVIEW === 'true'
