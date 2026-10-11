import { expect, test } from '@playwright/test'

test('markdown: safe rendering, exact code copying, heading links and wide tables', async ({ page }, testInfo) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const code = 'const example = "<img src=x onerror=alert(1)>"\nconsole.log(example)\n'
  const wideValue = 'long_column_'.repeat(30)
  const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6VQAAAAASUVORK5CYII='
  const content = `## 重复标题

正文包含 **重点**、*强调*、~~删除~~和 \`inline code\`。

\`\`\`typescript
${code}\`\`\`

\`\`\`text" onclick="alert(1)
</code></pre><script>alert(1)</script>
\`\`\`

<script>alert(1)</script>
[unsafe](javascript:alert(1))

## 重复标题

| 标识 | 内容 |
| --- | --- |
| \`${wideValue}\` | 这张表格需要在自己的区域内横向滚动。 |

> 引用中的内容保留阅读层次。

- 一级内容
  - 二级内容

![<b>图片说明</b>](${pixel})

[![链接图片](${pixel})](/archive)
`
  await page.route('**/api/v1/posts/markdown-check/comments*', route => route.fulfill({ json: [] }))
  await page.route('**/api/v1/posts/markdown-check', route => route.fulfill({ json: {
    id: 99, slug: 'markdown-check', title: 'Markdown 阅读检查', summary: '', content,
    status: 'published', category: null, tags: [], created_at: '2026-10-11T08:00:00Z',
    updated_at: '2026-10-11T08:00:00Z', published_at: '2026-10-11T08:00:00Z',
  } }))
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/posts/markdown-check')
  await expect(page.getByRole('heading', { name: 'Markdown 阅读检查', exact: true })).toBeVisible()
  await expect(page.locator('.article-body .hljs-keyword').first()).toBeVisible()
  await expect(page.locator('.article-body script, .article-body [onclick], .article-body img[onerror], .article-body a[href^="javascript:"]')).toHaveCount(0)
  await expect(page.locator('.markdown-figure figcaption')).toHaveText('<b>图片说明</b>')
  await expect(page.locator('.markdown-figure figcaption b')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '链接图片', exact: true })).toHaveAttribute('href', '/archive')
  const copy = page.getByRole('button', { name: '复制代码', exact: true }).first()
  await copy.click()
  await expect(copy).toHaveText('已复制')
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe(code)
  const headings = page.getByRole('heading', { name: '重复标题', exact: true })
  const ids = await headings.evaluateAll(nodes => nodes.map(node => node.id))
  expect(new Set(ids).size).toBe(2)
  await headings.nth(1).getByRole('link', { name: '链接到标题：重复标题', exact: true }).focus()
  await page.keyboard.press('Enter')
  expect(new URL(page.url()).hash).toBe(`#${encodeURIComponent(ids[1])}`)
  const table = page.getByRole('region', { name: '表格，可横向滚动' })
  expect(await table.evaluate(element => element.scrollWidth > element.clientWidth)).toBeTruthy()
  await table.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await page.getByRole('button', { name: /放大查看图片/ }).click()
  await expect(page.getByRole('dialog', { name: '查看图片' })).toBeVisible()
  await page.getByRole('button', { name: '关闭弹窗' }).click()
  await expect(page.getByRole('button', { name: /放大查看图片/ })).toBeFocused()
  await page.screenshot({ path: `previews/markdown-stress-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' })
  expect(errors).toEqual([])
})
