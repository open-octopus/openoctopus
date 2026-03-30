# OpenOctopus 家庭看板设计文档

> 日期：2026-03-17
> 状态：已确认，待实施
> 包名：`packages/dashboard` (`@openoctopus/dashboard`)

---

## 1. 产品定位

### 1.1 Dashboard 在产品中的位置

OpenOctopus 的核心交互是 **Chat-native**（群聊对话），Dashboard 是第三层辅助工具：

```
对话 80%  → 微信小程序 / Telegram Bot / Web Chat（日常交互）
卡片 15%  → Channel 系统主动推送（被动接收）
看板 5%   → Dashboard（按需查看全局 + 管理设置）← 本文档
```

### 1.2 目标用户

**家庭用户（非技术人员）**，而非开发者。妈妈、爸爸需要可视化界面来：
- 查看家庭全局状态（各域情况一览）
- 管理家庭成员（角色、权限、通知偏好）
- 管理实体（添加宠物/车辆/..., 编辑性格和提醒规则）
- 配置系统（AI 模型、通道连接、通知策略）

技术管理功能（系统日志、Agent 调试、RPC 方法、Docker）保留在 CLI (`tentacle`)。

### 1.3 设计原则

| 原则 | 说明 |
|------|------|
| **温暖家庭风** | 不是开发者控制台，是家庭状态板 |
| **亮色默认** | 家庭场景 ≠ 深色终端，亮色为默认，支持暗色切换 |
| **手机优先** | 主要在微信小程序 webview 或手机浏览器打开 |
| **极简操作** | 非技术用户零学习成本，表情符号 > 技术图标 |
| **按需打开** | 不是日常入口，不追求"日活"，追求"打开就有用" |

---

## 2. 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| **框架** | React 19 | 生态丰富，hooks 适配 WebSocket |
| **构建** | Vite 6 | 快速 HMR，与 OpenClaw 一致 |
| **样式** | Tailwind CSS v4 | 暗色主题支持好，utility-first |
| **组件库** | shadcn/ui | 零依赖，按需复制 |
| **图表** | Recharts | 健康趋势、财务概览 |
| **拓扑图** | React Flow | 星型路由可视化 |
| **状态管理** | Zustand 5 | 轻量，与 openclaw-office 一致 |
| **路由** | React Router 7 | 客户端 SPA |
| **i18n** | i18next + react-i18next | 中英双语，懒加载 |
| **语言** | TypeScript (strict) | 复用 `@openoctopus/shared` 类型 |
| **测试** | Vitest + Playwright | 单元 + 浏览器截图 |

### 部署模式

与 OpenClaw 官方 Control UI 一致：**构建产物由 ink Gateway 静态服务，零额外进程。**

```
生产模式：
  tentacle start
    └→ ink Gateway 启动
         ├─ Port 19789: WebSocket RPC
         ├─ Port 19790: HTTP REST + static(dashboard/dist/)
         └─ 访问 http://localhost:19790/dashboard/

开发模式：
  pnpm dashboard:dev    → Vite dev server (port 5173, HMR)
                          + ?gatewayUrl=ws://localhost:19789
  pnpm dashboard:build  → 产物输出到 packages/ink/public/dashboard/
```

---

## 3. 页面结构（5 页）

### 3.1 家庭总览（首页）

**用途：** 一眼看到家庭各域状态、今日事件、待处理项
**频率：** 每周 1-2 次

**布局：**
- 顶部：家庭名称 + 成员头像组
- 主体：Realm 状态卡片网格（已开启的域，每张卡片显示关键指标和待办）
- 下方：家庭时间线（最近的路由事件，谁说了什么 → 通知了谁）
- 底部：待处理项（需要确认的决策、即将到期的事项）

**Realm 卡片内容：**
- 域图标 + 域名
- 2-3 行关键状态摘要
- 告警标识（如有异常）
- 点击进入域内实体列表

### 3.2 路由视图

**用途：** 可视化 Hub-and-Spoke 消息路由，Demo 展示 wow moment
**频率：** Demo 展示 + 偶尔查看

**布局：**
- 主体：React Flow 星型拓扑图
  - 中心节点：🐙 AI 管家
  - 周围节点：家庭成员头像
  - 连线：消息流向动画（粗细/颜色表示相关性强度）
  - 未推送的成员节点灰显
- 下方：最近路由事件列表
  - 每条事件展开显示：原始消息 → 涉及域 → 各成员收到的定制版本 + 推送/未推送原因

### 3.3 家庭成员

**用途：** 管理家庭成员、角色、通知偏好
**频率：** 初始设置 + 偶尔调整

**功能：**
- 成员列表卡片（头像、姓名、角色、已连接通道）
- 邀请成员（生成二维码/分享链接）
- 编辑成员：
  - 角色：Owner / Adult / Child / Elder
  - 关注域：勾选关心的 Realm
  - 通道连接：微信/Telegram/Discord 绑定状态
  - 通知偏好：晨间简报开关、免打扰时段、推送频率
  - 交互偏好：语音优先（老人）、简化内容（儿童）、大字体

### 3.4 实体管理

**用途：** 浏览和管理 Realm 内的实体（宠物、车辆、人...）
**频率：** 添加新实体时、偶尔编辑

**功能：**
- 左侧：域筛选器
- 主体：实体卡片列表
- 实体详情：
  - 基本信息（名称、类型 living/asset/org/abstract、所属域、属性）
  - 性格设置（SOUL.md 简化编辑器）：语气、口头禅、特征标签
  - 主动提醒规则：条件 → 动作，可新增/编辑/删除
  - 记忆摘要：记忆条数、健康分、最近记忆条目

### 3.5 设置

**用途：** 系统级配置（AI、通道、通知、隐私、数据）
**频率：** 初始设置 + 偶尔调整

**分区：**
- **AI 模型**：当前模型、API Key（掩码显示）、备选模型切换
- **通道连接**：各 Channel 连接状态 + 连接/断开操作
- **通知策略**：晨间简报时间、最大推送频率、免打扰时段、紧急事件策略
- **域管理**：开启/关闭 Realm、域顺序调整
- **隐私**：数据存储位置（本地/云端）、数据可见性规则
- **数据**：导出家庭数据、清理历史记录

---

## 4. 视觉设计

| 维度 | 设计 |
|------|------|
| **基调** | 温暖家庭风，简洁清爽 |
| **默认主题** | 亮色（`#F6F8FA` Surface 背景），支持暗色切换 |
| **主色** | Ocean Blue `#1E3A5F`（标题/重点） |
| **强调色** | Summon Cyan `#00D4AA`（按钮/链接/活跃状态） |
| **告警色** | 橙色（需注意）、红色（紧急） |
| **圆角** | 大圆角 16px（卡片），8px（按钮），温暖感 |
| **字体** | Noto Sans SC（中文优先）+ Inter（英文） |
| **图标** | 表情符号风格，降低技术距离感 |
| **响应式** | 手机优先（360px 起），平板和桌面自适应 |
| **动画** | 路由视图的消息流向动画（克制，不花哨） |

---

## 5. 通信架构

### 5.1 WebSocket 客户端

```typescript
// gateway/client.ts
// 连接 ink Gateway WebSocket RPC (Port 19789)
// - auto-reconnect with exponential backoff
// - typed RPC methods (复用 @openoctopus/shared)
// - event subscription (chat.token, routing.event, health.alert...)
```

**复用已有 RPC 方法：**
- `realm.list/get/create/update/delete`
- `entity.list/get/create/update/delete`
- `summon.invoke/release/list`
- `status.health/info`
- `health.report`
- `maturity.scan`

**可能需要新增的 RPC 方法：**
- `member.list/get/create/update/delete` — 家庭成员管理
- `routing.history` — 路由事件历史
- `config.get/set` — 配置读写（简化版）
- `notification.preferences` — 通知偏好

### 5.2 数据流

```
Dashboard ──WebSocket──→ ink Gateway ──→ Core Services
    ↑                                        │
    └──── events (routing, health, chat) ────┘
```

---

## 6. 包结构

```
packages/dashboard/            @openoctopus/dashboard
├── package.json
├── vite.config.ts             # base: '/dashboard/', outDir → ../ink/public/dashboard
├── tsconfig.json              # references @openoctopus/shared
├── index.html
├── src/
│   ├── main.tsx               # React 入口
│   ├── App.tsx                # 根组件 + React Router
│   ├── gateway/
│   │   ├── client.ts          # WebSocket RPC 客户端
│   │   ├── types.ts           # 复用 @openoctopus/shared RPC 类型
│   │   └── events.ts          # 广播事件解析
│   ├── stores/
│   │   ├── gateway.ts         # 连接状态 (Zustand)
│   │   ├── family.ts          # 家庭成员 + 路由事件
│   │   └── realms.ts          # Realm + Entity 数据
│   ├── hooks/
│   │   ├── use-gateway.ts     # WebSocket 连接
│   │   ├── use-realms.ts      # Realm CRUD
│   │   ├── use-entities.ts    # Entity 管理
│   │   ├── use-members.ts     # 成员管理
│   │   └── use-routing.ts     # 路由事件订阅
│   ├── pages/
│   │   ├── Home.tsx           # 家庭总览
│   │   ├── RouteView.tsx      # 路由视图
│   │   ├── Members.tsx        # 家庭成员
│   │   ├── Entities.tsx       # 实体管理
│   │   └── Settings.tsx       # 设置
│   ├── components/
│   │   ├── layout/            # Shell, Sidebar, MobileBottomNav
│   │   ├── family/            # MemberCard, TopologyGraph, RouteAnimation
│   │   ├── realm/             # RealmCard, RealmGrid, Timeline, HealthBadge
│   │   ├── entity/            # EntityCard, SoulEditor, MemorySummary, RuleEditor
│   │   └── shared/            # Button, Card, Modal, Badge, Input, Select...
│   ├── styles/
│   │   └── globals.css        # Tailwind base + 品牌色 CSS 变量 + 亮/暗主题
│   └── i18n/
│       ├── zh.json            # 中文
│       └── en.json            # 英文
├── public/
│   └── favicon.png
```

---

## 7. 与现有架构的集成

### 7.1 ink Gateway 改动

- 在 HTTP 端口 (19790) 添加 `express.static('public/dashboard')` 路由
- 添加 `/dashboard` 路径的 SPA fallback (所有子路由返回 index.html)

### 7.2 monorepo 集成

- `pnpm dashboard:dev` → `pnpm --filter @openoctopus/dashboard dev`
- `pnpm dashboard:build` → 构建产物自动输出到 `packages/ink/public/dashboard/`
- `pnpm build` 命令中加入 dashboard 构建步骤

### 7.3 新增 RPC 方法（后端）

需要在 ink rpc-handlers 中新增：
- 家庭成员管理相关 RPC
- 路由事件历史查询
- 配置读写（面向非技术用户的简化接口）
- 通知偏好管理

---

## 8. 参考项目

| 项目 | 参考价值 |
|------|---------|
| **OpenClaw Control UI** | 部署模式（Vite 构建 + Gateway 静态服务） |
| **openclaw-office** | Zustand 状态管理 + React Flow 拓扑图 |
| **openclaw-dashboard (actionagentai)** | hooks 架构 + gateway-client 设计 |
| **ChatGPT Pulse** | 主动卡片设计理念 + "有意克制"推送策略 |
| **Ollie AI** | 家庭 AI 产品的群聊交互模式 |
| **Maple** | 家庭状态面板的信息密度参考 |

---

## 9. 不在范围内

以下功能不在 Dashboard 中实现：
- **Chat 聊天界面** — 在微信/Telegram/Web Chat 中
- **系统日志** — `tentacle` CLI
- **Agent 调试** — `tentacle` CLI
- **RPC 方法测试** — `tentacle` CLI
- **Docker 管理** — `tentacle` CLI + docker-compose
- **数据库操作** — `tentacle` CLI
