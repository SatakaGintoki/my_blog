import MarkdownIt from 'markdown-it'
import type { HLJSApi } from 'highlight.js'

let hljs: HLJSApi | undefined
let loading: Promise<void> | undefined
export const codeHighlightReady = () => !!hljs
export function loadCodeHighlight() {
  loading ??= import('./syntax-highlight').then(module => { hljs = module.default }).catch(error => { loading = undefined; throw error })
  return loading
}

export function createMarkdownParser(enableHighlight = true) {
  const parser = new MarkdownIt('default', { html: false })
  parser.core.ruler.after('inline', 'article-images', state => {
    for (let index = 0; index < state.tokens.length - 2; index++) {
      const [opening, inline, closing] = state.tokens.slice(index, index + 3)
      const image = inline.children?.[0]
      if (opening.type !== 'paragraph_open' || opening.hidden || inline.type !== 'inline' || inline.children?.length !== 1 || image?.type !== 'image' || closing.type !== 'paragraph_close') continue
      opening.type = 'figure_open'; opening.tag = 'figure'; opening.attrSet('class', 'markdown-figure')
      closing.type = 'figure_close'; closing.tag = 'figure'
      image.meta = { ...image.meta, standalone: true }
      const description = parser.renderer.renderInlineAsText(image.children || [], state.md.options, state.env).trim()
      if (description) {
        const caption = new state.Token('html_block', '', 0)
        caption.content = `<figcaption>${parser.utils.escapeHtml(description)}</figcaption>\n`
        caption.block = true
        state.tokens.splice(index + 2, 0, caption)
        index++
      }
      index += 2
    }
  })
  const renderImage = parser.renderer.rules.image!
  parser.renderer.rules.image = (tokens, index, options, env, renderer) => {
    const token = tokens[index]
    token.attrSet('loading', 'lazy'); token.attrSet('decoding', 'async')
    const image = renderImage(tokens, index, options, env, renderer)
    if (!token.meta?.standalone) return image
    const description = parser.utils.escapeHtml(String(token.attrGet('alt') || '文章图片'))
    return `<button type="button" class="image-zoom" data-image-zoom aria-label="放大查看图片：${description}">${image}</button>`
  }
  parser.renderer.rules.table_open = (tokens, index, options, _env, renderer) => `<div class="table-wrapper" role="region" aria-label="表格，可横向滚动" tabindex="0">${renderer.renderToken(tokens, index, options)}`
  parser.renderer.rules.table_close = (tokens, index, options, _env, renderer) => `${renderer.renderToken(tokens, index, options)}</div>\n`
  parser.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index]
    const requested = token.info.trim().split(/\s+/)[0].toLowerCase().slice(0, 40)
    const language = /^[\w-]+$/.test(requested) ? requested : 'text'
    const escaped = parser.utils.escapeHtml(token.content)
    let code = escaped
    if (enableHighlight && token.content.length <= 24000 && hljs?.getLanguage(language)) {
      try { code = hljs.highlight(token.content, { language, ignoreIllegals: true }).value }
      catch { /* Unsupported input remains readable as escaped plain code. */ }
    }
    const label = parser.utils.escapeHtml(language === 'text' ? 'PLAIN TEXT' : language.toUpperCase())
    return `<div class="code-frame"><div class="code-toolbar"><span class="code-language">${label}</span><button type="button" class="code-copy" data-code-copy aria-label="复制代码">复制</button></div><pre class="code-block" data-language="${parser.utils.escapeHtml(language)}" tabindex="0" aria-label="${label} 代码"><code class="language-${parser.utils.escapeHtml(language)}">${code}</code></pre></div>\n`
  }
  return parser
}
