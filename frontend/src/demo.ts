import type { Post, Site, Taxonomy } from './types'
import { defaultSite } from './site-defaults'
import markdownFlow from './demo-md-flow.svg?url&no-inline'

// Read-only fixtures for /preview. Never written to the user's database.
export const demoCategories: Taxonomy[] = [
  { id: 1, name: '前端开发', slug: 'frontend' },
  { id: 2, name: '工程实践', slug: 'engineering' },
  { id: 3, name: '问题记录', slug: 'notes' },
]
export const demoTags: Taxonomy[] = [
  { id: 1, name: '独立博客', slug: 'blog' }, { id: 2, name: 'TypeScript', slug: 'typescript' },
  { id: 3, name: '性能', slug: 'performance' }, { id: 4, name: 'React', slug: 'react' },
]
export const demoSite: Site = { ...defaultSite, about: '这里整理技术笔记、项目实践和问题排查记录，记录问题的背景、实现过程与验证结果。\n\n## 内容方向\n\n- 前端开发：组件、交互与 TypeScript。\n- 工程实践：开发工具、接口与部署。\n- 问题记录：排查过程、解决方案与取舍。\n\n这段介绍是设计预览中的示例。正式介绍可以在后台「站点设置」填写。' }
const content = `这是一篇用于检查技术文章排版的示例，包含代码、表格、实现步骤与验证记录。

## 问题与目标

列表组件同时需要处理加载、结果为空和请求失败。用明确的状态描述这些情况，可以减少组件中的条件分支。

目标是让状态转换清楚，让接口结果与页面反馈保持一致。

### 定义状态

使用 TypeScript 的联合类型区分状态，读取数据前先判断状态类型。

\`\`\`typescript
type RequestState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }

function isReady<T>(state: RequestState<T>) {
  return state.status === 'success'
}
\`\`\`

## 实现与取舍

组件只负责呈现，数据请求与状态更新放在独立的逻辑中。返回值里保留重试入口，便于错误恢复。

\`\`\`tsx
function Result({ state }: { state: RequestState<string[]> }) {
  if (state.status === 'loading') return <p>正在加载</p>
  if (state.status === 'error') return <p>{state.message}</p>
  return <ul>{state.data.map(item => <li key={item}>{item}</li>)}</ul>
}
\`\`\`

| 场景 | 页面反馈 | 后续动作 |
| --- | --- | --- |
| 请求中 | 加载状态 | 等待结果 |
| 结果为空 | 空状态说明 | 调整筛选条件 |
| 请求失败 | 错误说明 | 重试请求 |

![请求状态的流转：成功时展示结果，失败时保留重试入口](${markdownFlow})

> 先定义边界，再实现正常路径。错误状态同样属于组件行为。

## 验证与下一步

- 检查加载、成功、空数据与失败状态。
- 验证切换筛选条件后的结果更新。
- 检查键盘操作、深色模式和长代码行。

\`\`\`bash
npm run build
npm run lint
npm run test:e2e
\`\`\`

实际项目还需要结合请求取消、缓存与并发情况补充验证。本文内容仅用于设计预览。
`
export const demoPosts: Post[] = [
  ['搭建独立博客：前端、接口与部署', 'a-place-for-thoughts', '从路由与内容模型开始，整理一个博客的前端结构、接口边界与部署流程。', 2, [1, 4], '2026-10-08'],
  ['用 TypeScript 描述组件的状态', 'quiet-details', '通过联合类型明确加载、成功与错误状态，让组件的分支更容易理解和验证。', 1, [2, 4], '2026-10-05'],
  ['一次页面性能排查：从测量到验证', 'a-slower-day', '记录性能排查的步骤：建立基线、定位瓶颈、做出修改，再验证结果。', 3, [3], '2026-10-01'],
  ['React 组件中的数据流与副作用', 'from-idea-to-reality', '把状态、请求与渲染的职责讲清楚，减少组件之间隐含的依赖。', 1, [2, 4], '2026-09-26'],
  ['开发环境配置与常用命令备忘', 'a-note-to-myself', '整理环境变量、开发命令与排查方法，减少重复配置带来的成本。', 2, [1, 3], '2026-09-20'],
].map((row, index) => {
  const [title, slug, summary, categoryId, tagIds, date] = row as [string, string, string, number, number[], string]
  return { id: index + 1, title, slug, summary, content, status: 'published',
    category: demoCategories.find(c => c.id === categoryId)!, tags: demoTags.filter(t => tagIds.includes(t.id)),
    created_at: `${date}T08:00:00Z`, updated_at: `${date}T08:00:00Z`, published_at: `${date}T08:00:00Z` }
})
