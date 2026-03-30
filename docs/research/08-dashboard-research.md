# Dashboard 调研：OpenClaw 参考 + OpenOctopus 现状分析

> 更新时间：2026-03-17
> 目标：调研 OpenClaw Dashboard 实现方式，为 OpenOctopus Phase 2 Web Dashboard 提供参考
> 状态：调研完成，设计已确认 → 见 `docs/superpowers/specs/2026-03-17-family-dashboard-design.md`
>
> **最终决策：** 基于 Hub-and-Spoke 家庭中枢管家模型，Dashboard 定位为"轻量家庭看板"（非开发者管理控制台），
> 技术栈 Vite 6 + React 19 + Tailwind v4 + Zustand 5 + React Flow，构建产物由 ink Gateway 静态服务。

---

## 1. OpenOctopus 现状

### 1.1 已有用户接入层

| 接入方式 | 状态 | 说明 |
|---------|------|------|
| **tentacle CLI** | ✅ 完成 | 完整命令集 + TUI + WS RPC 流式聊天 |
| **Web Dashboard** | ⬜ Phase 2 | `packages/dashboard/` 未创建 |
| **Channels** | ✅ 完成 | Telegram, Discord, Slack, WeChat 适配器 |
| **营销网站** | ✅ 完成 | openoctopus.club (Astro + Vercel) |

### 1.2 后端 API 就绪度（ink 网关）

**HTTP REST 端点 (Port 19790)：**
- `GET/POST/PATCH/DELETE /api/realms` — Realm CRUD
- `GET/POST/PATCH/DELETE /api/entities` — Entity CRUD
- `POST /api/chat` — 自动路由聊天
- `POST /api/chat/realm/:id` — Realm 级聊天
- `POST /api/chat/entity/:id` — 召唤体聊天
- `GET /healthz`, `/readyz` — 健康检查

**WebSocket RPC (Port 19789)：**
- `chat.send` / `chat.stream` — 流式聊天
- `realm.list/get/create/update/delete` — Realm 管理
- `entity.list/get/create/update/delete` — Entity 管理
- `summon.invoke/release/list` — 召唤操作
- `status.health/info` — 系统状态
- `knowledge.inject`, `maturity.scan`, `directory.scan` — 知识生命周期
- `health.report`, `health.clean` — 健康管理

**广播事件：**
- `chat.token` / `chat.done` — 流式响应
- `channel.message` — 频道消息
- 健康告警、成熟度建议、跨域反应、主动消息

**结论：** 后端 API 覆盖全面，Dashboard 前端无需额外后端开发。

### 1.3 CLI (tentacle) 已有功能

**核心命令：**
- `start/stop/status` — 网关管理
- `chat` — 交互式聊天 (WS 流式 + HTTP 回退)
- `realm list/create/info/archive` — Realm 管理
- `entity list/add/info` — Entity 管理
- `config init/show/path/validate` — 配置管理
- `setup` — 交互式初始化向导
- `doctor` — 系统诊断

**TUI 内置命令 (聊天会话中)：**
- `/realms`, `/realm [name]`, `/entities` — 资源浏览
- `/summon [entity]`, `/release` — 召唤操作 (支持模糊匹配)
- `/health`, `/clean`, `/maturity`, `/scan`, `/inject` — 知识生命周期
- `/status`, `/help`, `/clear`, `/exit` — 会话控制

---

## 2. OpenClaw Dashboard 深度分析

### 2.1 官方内置 Control UI（核心参考）

OpenClaw 的 Dashboard 是**内置于 Gateway 的 SPA**，非独立应用。

**技术栈：**

| 层 | 选型 | 说明 |
|----|------|------|
| **UI 框架** | **Lit** (LitElement Web Components) | 轻量级 Web Components 库，非 React/Vue |
| **构建工具** | **Vite** | 快速构建，开发时热重载 |
| **语言** | TypeScript (strict) | 全类型安全 |
| **样式** | 全局 CSS (无 Shadow DOM) | `createRenderRoot()` 返回 `this`，样式全局生效 |
| **通信** | WebSocket (同端口) | 与 Gateway 共用 Port 18789 |
| **状态管理** | Lit `@state()` 响应式属性 | 单根组件 `OpenClawApp` 持有全部状态 |
| **持久化** | localStorage / sessionStorage | 设置用 localStorage，token 用 sessionStorage |
| **i18n** | 运行时语言切换 | 英/中/日/德/西/葡，懒加载非英语翻译 |
| **测试** | Playwright 浏览器截图测试 | `*.browser.test.ts` |
| **包管理** | pnpm | `pnpm ui:build` / `pnpm ui:dev` |

**核心架构特征：**
- `openclaw-app` 是根 LitElement 自定义元素
- 不使用 Shadow DOM，样式全局生效
- 所有数据通过单一 WebSocket 连接 (`GatewayBrowserClient`) 流转
- Gateway 直接 serve 构建产物，**零额外进程**
- `firstUpdated` 钩子中建立 Gateway 连接，消费 URL 参数 (token, session, gatewayUrl)
- 支持 `gatewayUrl` query param 连接远程 Gateway（开发模式）

**源码结构 (从 DeepWiki 和参考仓库推断)：**

```
ui/
├── public/                              # 静态资源
├── src/
│   ├── ui/
│   │   ├── app.ts                       # 根组件 OpenClawApp (LitElement)
│   │   ├── app-view-state.ts            # 视图状态管理
│   │   ├── app-render.ts                # 渲染逻辑
│   │   ├── gateway.ts                   # GatewayBrowserClient WebSocket 客户端
│   │   ├── storage.ts                   # localStorage/sessionStorage 封装
│   │   ├── chat/                        # 聊天界面组件
│   │   ├── components/                  # 通用 UI 组件库
│   │   ├── controllers/
│   │   │   └── config/                  # 配置管理控制器
│   │   ├── data/                        # 数据层
│   │   ├── types/                       # TypeScript 类型
│   │   ├── views/
│   │   │   └── usage-styles/            # 用量视图
│   │   └── test-helpers/                # 测试工具
│   ├── styles/
│   │   └── chat/                        # 聊天样式
│   └── i18n/
│       ├── locales/                     # 语言包
│       └── lib/                         # i18n 工具
```

**功能模块 (dashboard-v2, 2026.3.12)：**

| 视图 | 功能 | 对应 CLI |
|------|------|---------|
| **Overview** | 网关健康、Agent 概览、系统状态 | `status` / `health` |
| **Chat** | 流式对话、工具调用卡片、中止、斜杠命令、搜索、导出、置顶消息 | `agent --message` |
| **Config** | 树形配置编辑器，并发编辑保护，验证 | `config get/set` |
| **Agents** | Agent CRUD，Agent 状态查看 | `agents list/add/delete` |
| **Sessions** | 会话浏览、历史记录 | `sessions` |
| **Channels** | WhatsApp QR 配对、频道状态 | `channels` |
| **Cron** | 定时任务调度 (webhook/announcement/silent) | `cron list/add/run` |
| **Skills** | 技能市场浏览、可用性检查 | `skills list` |
| **Nodes** | 设备管理、能力检查 | `nodes` / `devices` |
| **Logs** | 实时日志流、过滤、导出 | `logs` |
| **Command Palette** | 命令面板（快速操作） | — |
| **Mobile Bottom Tabs** | 移动端底部导航 | — |

**安全机制：**
- 首次连接需设备配对 (device pairing)
- WebCrypto 生成设备身份 (需 HTTPS 或 localhost)
- 认证方式：token / password / Tailscale identity
- `connect.params.auth` 在 WebSocket 握手时认证
- token 存 sessionStorage（仅当前标签页），password 仅内存

**配置项：**
- `gateway.controlUi.basePath` — 自定义路径
- `gateway.controlUi.allowInsecureAuth` — localhost 兼容
- `gateway.controlUi.allowedOrigins` — 跨域白名单
- `gateway.controlUi.dangerouslyDisableDeviceAuth` — 紧急绕过

### 2.2 社区第三方 Dashboard（补充参考）

| 项目 | 技术栈 | 特点 |
|------|--------|------|
| **[openclaw-dashboard](https://github.com/actionagentai/openclaw-dashboard)** | Next.js 16 + React 19 + Tailwind v4 | 12 页面，speech-to-text，80+ RPC 方法类型，零数据库 |
| **[openclaw-office](https://github.com/WW-AI-Lab/openclaw-office)** | Vite 6 + React 19 + Zustand 5 + R3F | 3D 办公室可视化，Agent 协作动画，Recharts 数据图 |
| **[tenacitOS](https://github.com/carlosazaustre/tenacitOS)** | Next.js + React 19 + Tailwind v4 | 直接读取宿主文件系统，无额外后端 |
| **[openclaw-mission-control](https://github.com/manish-raana/openclaw-mission-control)** | Convex + React + Tailwind | 实时任务监控，Agent 协作 |
| **[openclaw-desktop](https://github.com/rshodoskar-star/openclaw-desktop)** | Electron + React + TypeScript | 桌面客户端，RTL 支持 |

**actionagentai/openclaw-dashboard 详细结构（最接近全功能参考）：**

```
app/                → 12 页面 + API 路由
├── page.tsx        → Overview (health, channels, agents)
├── chat/           → 流式聊天
├── agents/         → Agent CRUD
├── sessions/       → 会话浏览
├── models/         → LLM 模型目录
├── voice/          → TTS/STT/Talk
├── nodes/          → 设备管理
├── skills/         → 技能市场
├── channels/       → 频道管理
├── cron/           → 定时任务
├── config/         → 树形配置编辑器
└── logs/           → 实时日志流

lib/
├── gateway-client.ts    → WebSocket 客户端 (challenge-nonce 认证, 自动重连)
└── types.ts             → 80+ RPC 方法, 17 事件类型

hooks/
├── use-openclaw-gateway.ts     → 连接管理
├── use-openclaw-chat.ts        → 流式聊天
├── use-openclaw-agents.ts      → Agent 管理
├── use-openclaw-models.ts      → 模型列表
├── use-openclaw-sessions.ts    → 会话浏览
├── use-openclaw-tts.ts         → TTS
├── use-openclaw-nodes.ts       → 设备管理
└── use-speech-to-text.ts       → Web Speech API

contexts/
└── OpenClawContext.tsx → 共享连接状态

components/
├── Sidebar.tsx                → 侧边导航
├── FloatingMicButton.tsx      → 全局语音 (Cmd+Shift+M)
└── VoiceTranscriptPreview.tsx → 实时转写
```

---

## 3. OpenOctopus Dashboard 差异化机会

### 3.1 OpenClaw vs OpenOctopus 功能对照

| 功能 | OpenClaw Dashboard | OpenOctopus 需要 | 差异化价值 |
|------|-------------------|-----------------|-----------|
| **Chat** | ✅ 流式对话、工具调用、中止 | ✅ 相同 + Realm 路由 + Summon 对话 | 多域切换、召唤体对话模式 |
| **Config** | ✅ 树形编辑器 | ✅ JSON5 配置 + REALM.md + SOUL.md | 域/召唤体配置可视化 |
| **Agents** | ✅ Agent CRUD | ✅ 三层 Agent (Central/Realm/Summoned) | Agent 团队视图 |
| **Sessions** | ✅ 会话浏览 | ✅ JSONL 会话 | 按域/按实体筛选 |
| **Channels** | ✅ WhatsApp/Telegram/Discord | ✅ 相同 | — |
| **Logs** | ✅ 实时日志 | ✅ 相同 | 按域过滤 |
| **Overview** | ✅ 健康、Agent 概览 | ✅ **Realm Matrix 网格** | **核心差异：12 域网格面板** |
| **Realm Matrix** | ❌ 无域概念 | ✅ 12 域网格 + 健康分数 | **视觉冲击力最强的差异点** |
| **Summon** | ❌ | ✅ 实体→Agent 变身 | **召唤动画 + SOUL.md 编辑** |
| **Entity** | ❌ | ✅ 4 类实体管理 | **实体卡片 + 属性编辑** |
| **Health Lifecycle** | ❌ | ✅ 健康/成熟度/清理 | **趋势图 + 雷达图** |
| **Cross-Realm** | ❌ | ✅ 跨域反应 | **关系网络图** |
| **Knowledge** | ❌ | ✅ 目录扫描/注入 | **知识来源管理** |

### 3.2 Dashboard 页面规划

**核心页面（对标 OpenClaw + 差异化）：**

| 页面 | 对标 OpenClaw | OpenOctopus 差异化 |
|------|-------------|-------------------|
| 1. **Realm Matrix** (首页) | Overview | 12 域网格卡片，健康分数，快速操作，这是 CLI 无法表达的 |
| 2. **Chat** | Chat | Realm 切换器 + Summon 模式 + 多 Agent 对话 |
| 3. **Entities** | — (新增) | 4 类实体卡片，SOUL.md 可视化编辑器 |
| 4. **Health** | — (新增) | 域健康趋势图，成熟度雷达图，维护建议 |
| 5. **Config** | Config | JSON5 编辑器 + REALM.md 编辑器 |
| 6. **Agents** | Agents | 三层 Agent 视图 (Central/Realm/Summoned) |
| 7. **Sessions** | Sessions | 按域/实体分组浏览 |
| 8. **Channels** | Channels | 频道适配器管理 |
| 9. **Logs** | Logs | 按域过滤，跨域反应事件 |

---

## 4. 技术方案对比

### 4.1 OpenClaw 官方方案 (Vite + Lit)

| 优势 | 劣势 |
|------|------|
| 极轻量（Lit ~5KB, 无 Virtual DOM） | Lit 生态远小于 React |
| 原生 Web Components，无框架锁定 | 组件库/UI 库选择少 |
| Gateway 同端口 serve，零额外进程 | 复杂 UI（图表、动画）需更多手写 |
| 构建产物小 | 社区资源少，招聘/协作成本高 |

### 4.2 可选方案

| 方案 | 技术 | 优势 | 劣势 |
|------|------|------|------|
| **A) Vite + Lit** (照搬 OpenClaw) | Lit + Vite + Tailwind | 与参考项目 1:1 对齐，极轻量 | 生态小，图表/可视化库少 |
| **B) Vite + React SPA** (嵌入 ink) | React 19 + Vite 6 + Tailwind v4 | React 生态丰富（Recharts, shadcn/ui），开发效率高，构建产物由 ink 静态服务 | 比 Lit 略重 |
| **C) Next.js 独立应用** (原计划) | Next.js 16 + React 19 + Tailwind | SSR，文件路由，社区 dashboard 多用此方案 | 独立进程，需单独启动 |
| **D) Vite + React 独立包** | 同 B，独立 `packages/dashboard` | 开发独立热重载，构建后可选嵌入 | 需代理或 CORS 配置 |

### 4.3 推荐方案

**推荐 B) Vite + React SPA 嵌入 ink**，理由：

1. **与 OpenClaw 一致的部署模式** — 构建产物由 Gateway (ink) 静态服务，`tentacle start` 一键启动
2. **React 生态优势** — Recharts (健康趋势图)、React Flow (跨域关系图)、shadcn/ui (组件库) 开箱即用
3. **与社区方案对齐** — openclaw-dashboard、openclaw-office 均用 React 19，经验可复用
4. **开发体验** — Vite HMR，TypeScript strict，hooks 模式天然适合 WebSocket 状态管理
5. **构建产物轻量** — SPA 构建后仅静态文件，Express `static()` 中间件即可服务

**与 OpenClaw 的差异决策：**
- OpenClaw 用 Lit 是因为追求极简（它的 Dashboard 是辅助功能），我们的 Dashboard 是核心差异化入口（Realm Matrix 需要丰富的可视化），React 更合适

---

## 5. 参考资源

### 官方文档
- [Dashboard - OpenClaw Docs](https://docs.openclaw.ai/web/dashboard)
- [Control UI - OpenClaw Docs](https://docs.openclaw.ai/web/control-ui)
- [OpenClaw Architecture](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)

### 社区 Dashboard 项目
- [actionagentai/openclaw-dashboard](https://github.com/actionagentai/openclaw-dashboard) — Next.js 16 + React 19，最完整的全功能参考
- [WW-AI-Lab/openclaw-office](https://github.com/WW-AI-Lab/openclaw-office) — Vite 6 + React 19 + R3F，3D 可视化参考
- [carlosazaustre/tenacitOS](https://github.com/carlosazaustre/tenacitOS) — Next.js + React 19，直接读文件系统
- [mudrii/openclaw-dashboard](https://github.com/mudrii/openclaw-dashboard) — 零依赖命令中心
- [tugcantopaloglu/openclaw-dashboard](https://github.com/tugcantopaloglu/openclaw-dashboard) — 安全认证 + TOTP MFA
- [grp06/openclaw-studio](https://github.com/grp06/openclaw-studio) — 简洁 Agent 管理

### 技术参考
- [OpenClaw GitHub](https://github.com/openclaw/openclaw) — 官方源码
- [OpenClaw DeepWiki - Control UI](https://deepwiki.com/openclaw/openclaw/5-control-ui) — 架构分析
