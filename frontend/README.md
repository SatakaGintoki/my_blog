# Kuronya 前端

React + TypeScript + Vite，接入项目已有 FastAPI。没有独立的模拟管理后台；登录、写作、上传、审核等操作均由后端验证并持久化。

前台与后台统一采用杂志网格风格：近白底、炭灰标题、柔蓝强调、淡点阵与清晰的栏目分隔。主题变量集中在 `src/styles.css`；前台与后台布局分别在 `src/journal.css`、按需加载的 `src/admin.css`。正文和操作面板保留适合阅读、编辑的实色区域，深浅主题同步切换。

## 开发

在项目根目录完成 Python 依赖安装，然后：

```powershell
cd frontend
npm ci
cd ..
.\start.ps1
```

首次启动会在没有 `.env` 时生成本地随机密钥。已有 `.env` 不会被覆盖。API 为 `127.0.0.1:8000`，Vite 为 `127.0.0.1:5173`。同源代理转发 `/api` 与 `/uploads`，本地无需修改 CORS。

管理员没有默认密码。在另一个终端、项目根目录中执行：

```powershell
.\.venv\Scripts\python.exe -m app.cli create-admin --username Kuronya
```

密码交互输入，至少 12 个字符。使用 `/admin/login` 登录。

如果 Windows 上虚拟环境的 Python 无法启动，可以使用同一主次版本的已安装 Python（本项目环境为 Python 3.14），并复用已有依赖。在项目根目录执行：

```powershell
$env:PYTHONPATH = Join-Path $PWD '.venv/Lib/site-packages'
$env:BLOG_PYTHON = (Get-Command python).Source
& $env:BLOG_PYTHON -m app.cli create-admin --username Kuronya
```

`start.ps1` 支持 `BLOG_PYTHON` 指定解释器；浏览器测试对应使用 `BLOG_E2E_PYTHON`。它们默认仍使用项目虚拟环境。

## 填写个人介绍

登录后进入 **站点设置 → 个人介绍与博客**：

- **你的昵称**：显示在首页、页尾与文章信息中。
- **一句话介绍**：显示在首页名字下，以及关于页标题下。
- **关于我**：支持 Markdown。第一段普通文字摘取至首页（最多 180 字），完整内容显示在 `/about`。
- 右侧 **个人介绍预览** 随输入即时更新；点击 **保存站点信息** 后公开生效。

登录状态下，关于页提供 **编辑我的介绍**，直接定位到后台「关于我」文本框。开发环境的 `/preview` 展示独立示例，个人设置的实际结果请在 `/` 和 `/about` 查看。

## 页面

- `/` 首页，`/articles` 文章列表与搜索/分类/标签筛选。
- `/posts/:slug` 阅读页、目录、阅读进度、评论。
- `/archive` 时间归档，`/about` 关于。
- `/admin` 概览；`/admin/posts` 文章管理；`/admin/posts/new` 写作。
- `/admin/comments` 审核评论；`/admin/taxonomy` 分类标签；`/admin/settings` 个人信息、评论开关和密码修改。
- `/preview` 独立只读设计预览，文章与分类为示例。不会向数据库写入示例，也不提供免登录后台。

首页显示第一页最新发布的文章。阅读时间按正文长度估算。文章列表、归档和评论都支持分页。错误和空数据明确提示。站点信息支持在后台修改。昵称预设为 Kuronya，未添加职业或联系方式。

## 电脑端体验

主要面向电脑浏览器。首页采用杂志网格，内容宽度约 1064 像素；文章索引内容约 992 像素，分类和日期两端对齐，摘要最多展示三行。正文阅读列约 712 像素，字号为 17 像素（手机 16 像素），行距 1.9。1280 像素以上屏幕的文章目录位于右侧留白，展开后随阅读滚动保持可用；较窄窗口中仍是正文前的折叠入口。主文章采用衬线标题和 CSS 斜线图文块；内容进入视野时渐入，悬停和键盘聚焦时箭头与斜线轻微移动。减弱动态效果模式下取消动画。

后台编辑支持 **Ctrl / ⌘ + S**。保存保持当前发布状态：新文章仍为草稿，已发布文章只更新内容。标题、slug 或正文不完整时显示提示；上传、保存或草稿恢复确认期间不会触发新的快捷键保存。宽屏下编辑工具栏与文章设置固定在滚动区域的可用位置，分栏编辑与预览各自保留滚动空间。

Markdown 原始 HTML 被禁用，渲染结果再次通过 DOMPurify 清理。编辑器保存时提交 `expected_updated_at`，409 冲突保留当前文字并支持下载 Markdown。离开前提醒，本地草稿以 `kuronya-draft-*` 存于 localStorage，服务器保存成功后清除；JWT 仅存 sessionStorage。共享电脑使用后可清理本站浏览器数据。

正文、关于页和后台预览共用 Markdown 渲染与排版。代码块提供语言标签、复制及横向滚动；表格在独立区域内滚动；标题可直接定位。单独成段的图片显示替代文本说明，支持点击放大、Esc 关闭及焦点恢复；包在链接中的图片仍打开原链接。复制按钮需要浏览器允许剪贴板写入，失败时显示手动复制提示。`src/demo-md-flow.svg` 仅用于开发预览，默认部署包不包含这张示例图。

## 检查

```powershell
npm run build
npm run audit:dist
npm run lint
npx playwright install chromium
npm run test:e2e
```

浏览器测试启动临时 SQLite API（8001）与测试 Vite（5174），不使用正式数据库或管理员。Windows 使用系统已安装的 Microsoft Edge，其他系统使用 Playwright Chromium。运行前请确保这两个测试端口空闲。测试截图在 `previews/`，失败诊断在 `test-results/`。

当前浏览器尺寸为 1440×1000、1920×1080 和 390×844。桌面检查包含目录位于正文外侧、键盘保存草稿，以及键盘保存已发布文章后仍可公开阅读。

## 部署

项目根目录的 `docker compose up -d --build` 同时构建后端与前端。前端 Nginx 提供静态文件并转发 API，映射宿主机 `127.0.0.1:8080`。外层域名 Nginx 配置见 `deploy/nginx.conf.example`；公开访问请配置 HTTPS。

正式构建默认不开放 `/preview`，不打包示例文章；需要保留时在构建前设置 `VITE_ENABLE_PREVIEW=true`。页面采用文字介绍，已停用头像；此前生成的插画保存在 `design-assets`，不参与部署。后端容器仅安装 `requirements-prod.txt` 中的运行依赖。资源体积、缓存与验证详情见 [部署资源检查](../deploy/RESOURCE-AUDIT.md)。

`npm run preview` 仅用于查看构建产物，不提供后端代理。完整接口测试使用开发代理，生产使用上述 Nginx。当前为客户端渲染页面；分享预览和搜索引擎完整抓取若成为重点，可继续增加服务端渲染与动态元信息。

设计参考与视觉说明见 [DESIGN.md](./DESIGN.md)。
