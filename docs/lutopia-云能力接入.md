# 云能力接入方案（记忆 / 主动消息 / MCP）

> 背景：用户希望使用 `lutopia.app/companion` 清单里的能力，但不想在手机部署、不想一直开着电脑当服务器。

## 一、先分清：清单不是软件

`lutopia.app/companion/guide` 是一个**目录**，收录 190 个开源项目，每个项目由作者独立维护。它本身没有 API、不能“接入”，也没有东西可以直接部署来给你用。要用的是**其中某一个项目**。

## 二、GitHub 能部署什么

| 方式 | 能做什么 | 不能做什么 | 要一直开机吗 |
|---|---|---|---|
| GitHub Pages | 纯静态网页 | 不能跑 Node/Python 后端、不能常驻数据库/WebSocket | 否 |
| GitHub Actions | 构建 APK、定时任务、CI | 不是 7×24 托管服务，会休眠、有额度 | 否，但不能当服务器 |
| Cloudflare / Vercel / Supabase / Netlify | Serverless 函数、数据库、存储 | 有平台限制与额度 | 否，云上常驻 |
| VPS / 家里旧电脑 / 树莓派 | 任何 Python/Node 常驻服务 | 关机/睡眠就断 | **是** |

结论：**“用 GitHub 部署”只对静态前端成立**；常驻后端必须放云平台或 VPS。

## 三、对你现有 float 的结论

float 本身已经内置了这三项能力，而且后端是 serverless，不需要你一直开电脑：

| 能力 | float 现状 | 是否需要再部署 lutopia 项目 |
|---|---|---|
| 长期记忆 | 本地 IndexedDB + 云备份（Supabase Storage） | 不需要；想要“独立记忆网关”才看 Pawwake |
| 主动消息 / 定时消息 / 离线推送 | Supabase Edge Functions + Realtime | 不需要；Dylan Heartbeat 只适配 Kelivo |
| MCP | 内置 `/api/tool-proxy` + 直连模式 | 不需要；公网 MCP 直接可用 |

## 四、如果你一定要一个「独立记忆网关」：Pawwake

Pawwake（原名 AI Memory Gateway，<https://github.com/garan0613/pawwake>）是清单里最匹配“长期记忆”的项目：一个 OpenAI 兼容的转发网关，自动提取记忆并注入上下文。

- 技术栈：Python + PostgreSQL（可选 pgvector），需要一个**常驻 Web 进程**。
- 不能跑在 Cloudflare Workers / Vercel 的纯函数里；推荐 **Render 免费档** 或 **Railway**。
- 数据库用 **Neon** 或 **Supabase** 免费档即可。
- 许可证：AGPL-3.0。

### 部署步骤（Render，最省事）

1. 打开一键部署：<https://render.com/deploy?repo=https://github.com/garan0613/pawwake>
2. 创建时填写：
   - `DASHBOARD_PASSWORD`：你自己设一个强密码
   - `DATABASE_URL`：Neon / Supabase 的连接串
   - `GATEWAY_SECRET` / `SESSION_SECRET`：自动生成，记下来
3. Neon 连接串末尾如果有 `&channel_binding=require`，**删掉这一段**。
4. 部署成功后访问 `https://你的服务.onrender.com/dashboard`，在「设置 → 基础连接」填：
   - API 地址（你的 LLM 中转站 / 官方地址）
   - API Key
   - 默认模型；需要记忆提取时再填记忆模型
5. 记下 `GATEWAY_SECRET`，下面接 float 用。

> Render 免费档长时间无请求会休眠，首次唤醒会慢几十秒；这是免费档特性，不是故障。

### 接进 float

float 的 API 设置现在支持**自定义请求头**（本次新增），所以可以对接 Pawwake 的 `X-Gateway-Key`：

1. 打开「设置 → API 设置 → 你的配置」
2. Base URL 填 Pawwake 网关地址（通常是 `https://你的服务.onrender.com/v1`）
3. API Key 填 `GATEWAY_SECRET`
4. 在「自定义请求头」里填一行：
   ```
   X-Gateway-Key: 你的 GATEWAY_SECRET
   ```
5. 保存后用「检测 API」验证。

> 如果 Pawwake 版本要求 `Authorization` 也必须是网关密钥，把 API Key 留成 `GATEWAY_SECRET` 即可。

## 五、主动消息

- **float 用户**：直接用内置的「离线推送 / 定时消息 / 主动消息」，后端是 Supabase Edge Functions，不需要常开电脑。
- **Dylan Heartbeat**（<https://github.com/callie0313/dylan-heartbeat>）是给 **Kelivo** 用的常驻插件，要求 Railway/Render 常驻 Node 进程 + `wake_up.js` 定时唤醒，且 MCP 仍在“后续计划”。**不推荐接到 float。**
- 许可证为 PolyForm Noncommercial，禁止付费代部署与商业使用。

## 六、MCP

- float 已有 `/api/tool-proxy`：公网 http/https 的 MCP 即使不带 CORS 也能走服务端转发。
- 本机 / 局域网 MCP（`localhost`、`192.168.x.x`）：被 SSRF 防线拦截，需要：
  1. 编辑该 MCP → 勾选「直连模式」（要求 MCP 允许 CORS，且是 Streamable HTTP `/mcp`）；
  2. 或用 `cloudflared` / `ngrok` 把它暴露成公网 https（**电脑必须开着**）；
  3. 或把该 MCP 的服务端逻辑改写成 Cloudflare Worker / Supabase Edge Function（需要我针对具体 MCP 来写）。

## 七、本次代码改动

- 新增 `lib/device-performance.ts` 与 `styles/performance.css`：低配流畅模式（关闭毛玻璃与循环动画）。
- `app/layout.tsx`：首帧前挂 `data-perf`，避免闪动。
- `设置 → Runtime`：新增「低配流畅模式」开关。
- `Settings → API 设置`：新增「自定义请求头」，用于 Pawwake 等需要额外请求头的网关。
- 安卓壳：`hardwareAccelerated`、禁用缩放/滚动条/overscroll、主题底色打底。

## 八、我无法代替你的一步

部署到 Render / Railway / Supabase 需要**你本人登录并授权**。我可以把代码、配置、步骤全部写好，但点“部署/授权”这一步只能你来。
