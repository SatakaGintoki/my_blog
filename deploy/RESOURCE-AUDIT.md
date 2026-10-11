# 部署资源检查（2026-10-10）

本轮检查了前端产物、资源引用、依赖用途、Docker 构建上下文与 Nginx 路由。没有连接服务器或执行上线。

## 精简结果

| 项目 | 调整前 | 调整后 |
| --- | ---: | ---: |
| 前端静态文件合计 | 8.28 MB | 5.38 MB |
| 网页头像 | 2.80 MB PNG | 已停用，不打包头像 |
| 首页入口脚本 | 541.64 KB | 477.41 KB（构建报告 gzip 164.51 KB） |
| 样式产物 | 165.14 KB | 154.25 KB |
| 字体文件 | 105 个，4.73 MB | 100 个，4.64 MB |

单位采用十进制。静态文件合计是服务器存储体积，不是每次访问的下载量。

头像原始插画与 WebP 均保留在 `frontend/design-assets`，不进入静态网站或 Docker 构建目录。首页与设置页的个人介绍预览已改为纯文字。

首页不再加载语法高亮代码；遇到包含代码块的文章或 Markdown 预览时才加载约 60 KB 的独立模块。加载失败仍显示经过转义和清理的普通代码。后台继续按路由加载。清理旧宣传页 CSS 时保留了后台动态生成的分栏模式样式。

Inter 保留拉丁与扩展拉丁两个字体分片；其他文字仍有中文字体与系统字体回退。Noto Sans SC 保留全部字符分片，以免以后写新文章时缺字。浏览器通过 `unicode-range` 按当前文本下载匹配分片，不会每次下载全部字体。OFL 字体许可证属于必要随附文件，保留。

## 生产包的内容

- 默认生产构建禁用 `/preview`，不包含示例文章模块。开发服务器保留预览；如确需生产预览，在构建前设置 `VITE_ENABLE_PREVIEW=true`。
- 最终前端容器只复制 `dist`，没有 Node.js、`node_modules`、TypeScript 源码、Playwright、截图、日志或原始插画。
- 后端 Docker 使用 `requirements-prod.txt`，去掉 pytest、httpx 及仅服务于测试的依赖；开发与测试继续使用 `requirements.txt`。
- 上传源项目到服务器时无需带 `.venv`、`frontend/node_modules`、`frontend/dist`、`frontend/previews`、`frontend/design-assets`、测试报告、缓存与日志。服务器配置 `.env` 单独设置；正式数据库和上传图片属于持久数据，不应当作冗余文件删除。

## 资源路由与缓存

前端 Nginx 对 CSS、JavaScript、JSON 与 SVG 开启 gzip，WOFF2 / WebP 已压缩，不重复压缩。带哈希的 `/assets/` 使用一年不可变缓存；头像和图标使用七天缓存；HTML 需要重新验证。缺失静态资源返回 404，不会误返回 SPA HTML。

`/api/` 与 `/uploads/` 使用优先前缀代理，避免静态图片规则截走上传图片。宿主机 Nginx 只对登录和 API 限流，不再把并行字体请求一起限流。前端字体、图标与头像均为本地资源，不依赖参考博客或外部字体 CDN。

## 验证与边界

- 生产构建与 ESLint 通过。
- `npm run audit:dist` 检查 HTML / CSS / JS 中的静态引用、缺失文件和开发文件混入，当前通过。
- 12 项浏览器检查通过，覆盖三个屏幕尺寸，以及发布、上传、审核、草稿恢复、并发保护与设置保存。
- 24 项后端测试通过；现有 Starlette 测试客户端有一条依赖弃用提示，不影响运行。
- 使用生产构建做浏览器检查：头像与字体加载正常；首页没有请求后台、示例和高亮模块；代码文章按需高亮；生产预览关闭；无资源错误。
- 根据已安装且同版本的包元数据，检查了 Linux / Python 3.13 的运行依赖闭包，没有缺失依赖。
- 本机没有 Docker / Nginx，容器构建和两层 Nginx 的真实运行尚未验证；服务器上线时仍需 `docker compose up -d --build`、`nginx -t` 与实际 HTTPS 域名检查。

依赖更新时，分别从 `requirements.in` 生成 `requirements-prod.txt`，从 `requirements-dev.in` 生成 `requirements.txt`；不要只更新其中一份锁定版本。
