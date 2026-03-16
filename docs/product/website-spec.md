# OpenOctopus 官网开发参考文档

> 网站项目：[`open-octopus/openoctopus.club`](https://github.com/open-octopus/openoctopus.club)
> 线上地址：**https://openoctopus.club**
> 参考对标：https://openclaw.ai/ （Astro + Vercel）

---

## 1. 项目规划

### 1.1 仓库与部署（已完成）

| 项 | 值 | 状态 |
|---|---|---|
| 仓库 | `open-octopus/openoctopus.club` | done |
| 框架 | Astro 5 + Tailwind CSS 3 | done |
| 图片优化 | Astro Image (sharp, auto WebP) | done |
| 字体 | Inter + JetBrains Mono + Noto Sans SC（Google Fonts CDN） | done |
| 部署 | Vercel + GitHub 集成（push 自动部署） | done |
| 域名 | `openoctopus.club`（已绑定 Vercel） | done |

### 1.2 参考站点分析（openclaw.ai）

OpenClaw 网站结构（Astro + Vercel + 深色主题优先）：

1. **Header** — Logo + 主题切换（☀/☾）+ 导航
2. **Hero** — 核心价值主张 + 平台支持说明
3. **社会证明** — 100+ 推特用户评价
4. **快速安装** — 4 种安装方式（npm / git / brew / 源码）
5. **功能展示** — 6 大核心能力
6. **集成矩阵** — 40+ 支持的平台/服务
7. **媒体报道** — 科技媒体文章
8. **CTA 按钮** — Discord / Docs / GitHub / ClawHub
9. **Footer** — 版权 + 链接

---

## 2. 品牌标识

### 2.1 基本信息

| 维度 | 值 |
|---|---|
| 产品名 | **OpenOctopus**（Open八爪鱼） |
| 主标语（EN） | Organize life by realms. Summon anything into a living agent. |
| 主标语（CN） | 把人生分域治理，把万物召唤为 Agent。 |
| 技术定位 | Realm-native life agent system |
| 战斗口号 | **SUMMON!** |
| 吉祥物 | **Octo** — 深海章鱼，冷静、多线程、睿智 |
| 名言 | *"A deep-sea octopus, definitely."* |

### 2.2 短标语池

| 场景 | 标语 |
|---|---|
| 技术向 | `Realm-native life agent system.` |
| 行动向 | `Eight arms. Every realm covered.` |
| 召唤向 | `Summon your world.` |
| 趣味向 | `More arms, more done.` |
| 哲学向 | `One brain. Many realms. Everything summoned.` |
| 社区向 | `Your life, orchestrated.` |

### 2.3 Tone of Voice

| 维度 | 描述 |
|---|---|
| 直接 | 不绕弯子，技术内容用最短句子 |
| 沉稳 | 深海的沉静力量——SUMMON 安静但强大 |
| 幽默克制 | 偶尔章鱼梗（tentacles, ink, reef），不滥用 |
| 赋能感 | "我的人生被系统化管理了" |
| 技术自信 | 开源、本地优先、可审计是设计选择 |

**该说的：** "Your data, your tentacles." / "Eight arms. Every realm covered." / "Summon your world."

**不该说的：** "AI-powered" / "Smart assistant" / "Revolutionary"

---

## 3. 视觉设计系统

### 3.1 色彩方案

| 用途 | 色值 | 命名 | CSS 变量建议 |
|---|---|---|---|
| 主色 | `#1E3A5F` | Deep Ocean Blue | `--color-ocean` |
| 副色 | `#6C3FA0` | Octopus Purple | `--color-purple` |
| 强调色 | `#00D4AA` | Summon Cyan | `--color-cyan` |
| 渐变 | `#6C3FA0 → #00D4AA` | Summon Gradient | `--gradient-summon` |
| 暗背景 | `#0D1117` | Abyss | `--bg-dark` |
| 亮背景 | `#F6F8FA` | Surface | `--bg-light` |
| 暗文字 | `#E6EDF3` | — | `--text-dark` |
| 亮文字 | `#1F2328` | — | `--text-light` |
| 社区蓝 | `#5865F2` | Discord Blue | `--color-discord` |

### 3.2 品牌文字

- `Open` — Regular weight，随主题色变（暗底白字，亮底黑字）
- `Octopus` — **Bold**，固定使用 Octopus Purple `#6C3FA0`
- 参考 OpenClaw 的 "**OPEN**CLAW" 做法

### 3.3 字体

| 用途 | 字体 |
|---|---|
| 品牌/标题 | Inter Bold / Noto Sans SC Bold |
| 代码/技术 | JetBrains Mono / Fira Code |
| 正文 | Inter / Noto Sans SC |

### 3.4 设计风格

- **Dark-mode 优先** — 深海主题，暗色为默认
- **召唤光效** — Summon 操作时，青色光芒扩散
- **渐变点缀** — 紫青渐变用于关键交互元素
- **圆润几何** — 圆角、流动线条（章鱼的柔软）
- **矩阵布局** — Realm Matrix 用网格卡片，卡片微微发光

---

## 4. 图片资产

> 已复制到网站项目 `src/assets/` 下，Astro 自动优化为 WebP。

### 4.1 品牌素材（网站 src/assets/brand/）

| 网站文件名 | 来源 | 用途 | 状态 |
|---|---|---|---|
| `logo-light.png` | `docs/assets/openoctopus-logo-text.png` | Header（暗色主题） | done |
| `logo-dark.png` | `docs/assets/openoctopus-logo-text-dark.png` | Header（亮色主题） | done |
| `mascot.png` | `docs/assets/openoctopus-mascot.png` | Octo 吉祥物区 | done |
| `avatar.png` | `docs/assets/openoctopus-avatar.png` | 备用 | done |
| `banner.png` | `docs/assets/openoctopus-banner.png` | Hero 区 + OG 预览 | done |
| `summon-concept.png` | `docs/assets/openoctopus-summon-concept.png` | Summon 区 | done |
| `hero-bg.png` | AI 生成 | Hero 背景（生物发光深海粒子） | done |
| `realm-icons.png` | AI 生成 | Realm Matrix 区（12 域统一图标） | done |
| `summon-sequence.png` | AI 生成 | Summon 区（4 帧变身序列） | done |
| `comparison.png` | AI 生成 | Comparison 区（竞品象限图） | done |

### 4.2 架构图（网站 src/assets/architecture/）

| 网站文件名 | 来源 | 状态 |
|---|---|---|
| `overview.png` | `docs/images/架构图/整体架构总览.png` | done |
| `realm-routing.png` | `docs/images/架构图/Realm 路由流程图.png` | done |
| `summon-engine.png` | `docs/images/架构图/Summon 引擎概念图.png` | done |
| `tech-stack.png` | `docs/images/架构图/技术栈全景.png` | done |

### 4.3 信息图（网站 src/assets/infographics/）

| 网站文件名 | 来源 | 状态 |
|---|---|---|
| `realm-system.png` | `docs/images/信息图/八爪鱼人生治理系统.png` | done |
| `brand-spec.png` | `docs/images/信息图/OpenOctopus 品牌概念视觉规范.png` | done |
| `paradigm.png` | `docs/images/信息图/OpenOctopus：AI人生治理范式.png` | done |

---

## 5. 页面结构设计

### 5.1 推荐页面（单页 Landing Page）

```
┌──────────────────────────────────────┐
│ HEADER                               │
│ Logo(自动切换深/浅) + Nav + 主题切换   │
│ [Docs] [GitHub] [Discord] [RealmHub] │
├──────────────────────────────────────┤
│ HERO                                 │
│ "SUMMON!"                            │
│ Organize life by realms.             │
│ Summon anything into a living agent. │
│ [Get Started] [GitHub ★]             │
│ 配图: banner.png                     │
├──────────────────────────────────────┤
│ WHAT IS OPENOCTOPUS                  │
│ 三个章鱼隐喻卡片:                     │
│ 🐙 八臂并行 = Realm 分域治理          │
│ ✨ 触手发光 = Summon 召唤             │
│ 🧠 中央大脑 = 跨域协同               │
├──────────────────────────────────────┤
│ REALM MATRIX                         │
│ 12 域视觉卡片网格 (4x3)              │
│ 每张卡片: 图标 + 域名 + 示例 Agent    │
│ 配图: 八爪鱼人生治理系统.png           │
├──────────────────────────────────────┤
│ SUMMON — THE KILLER FEATURE          │
│ 实体 → Agent 转化动画/示意            │
│ 4 种实体类型卡片                      │
│ 多 Agent 对话演示 (出差场景)           │
│ 配图: summon-concept.png             │
├──────────────────────────────────────┤
│ HOW IT WORKS                         │
│ 三步流程:                             │
│ 1. 创建 Realm 划分人生域              │
│ 2. 录入实体，Summon 召唤为 Agent      │
│ 3. Agent 自主行动，跨域协作            │
│ 配图: Realm 路由流程图.png             │
├──────────────────────────────────────┤
│ FEATURES (6 卡片)                    │
│ · Realm Matrix — 网格化人生治理       │
│ · Summon — 万物皆可 Agent            │
│ · Cross-Realm Intelligence           │
│ · Dual-layer Skills                  │
│ · Agent Teams — 三层代理协作          │
│ · Local-first — 本地优先架构          │
├──────────────────────────────────────┤
│ VS COMPARISON                        │
│ OpenOctopus vs ChatGPT vs Notion AI  │
│ vs AutoGPT 对比表                    │
├──────────────────────────────────────┤
│ REALMHUB                             │
│ "Like an app store for life domains" │
│ 3 个示例域包卡片                      │
├──────────────────────────────────────┤
│ QUICK START                          │
│ npm i -g openoctopus                 │
│ tentacle init                        │
│ tentacle summon                      │
├──────────────────────────────────────┤
│ ARCHITECTURE                         │
│ ASCII 架构图 或 配图: 整体架构总览.png │
├──────────────────────────────────────┤
│ ECOSYSTEM                            │
│ 生态命名表:                           │
│ RealmHub / tentacle / ink / summon   │
│ The Reef / REALM.md / SOUL.md        │
├──────────────────────────────────────┤
│ OCTO (吉祥物)                        │
│ 配图: mascot.png                     │
│ "A deep-sea octopus, definitely."    │
├──────────────────────────────────────┤
│ COMMUNITY                            │
│ [Discord] [X/Twitter] [GitHub]       │
│ [小红书] [知乎] [TikTok]             │
├──────────────────────────────────────┤
│ FOOTER                               │
│ MIT License · Open八爪鱼              │
│ GitHub · Discord · X · 文档链接       │
└──────────────────────────────────────┘
```

---

## 6. 核心内容文案

### 6.1 Hero 区

**标题：** SUMMON!

**副标题：** Organize life by realms. Summon anything into a living agent.

**描述：** OpenOctopus is not another unified chatbox. It organizes your life into Realms — each with its own knowledge base, agent team, and skill set. Like an octopus, each tentacle acts autonomously while the central brain coordinates everything.

### 6.2 三个隐喻（What is OpenOctopus）

1. **八臂并行 = Realm 分域治理**
   章鱼有 8 条触手，每条拥有独立神经中枢。OpenOctopus 的每个 Realm 同理——独立运转，自主管理。

2. **触手发光 = Summon 召唤**
   深海章鱼的触手末端发出生物光。这道光就是"召唤"——触手触碰到什么，什么就获得数字生命。

3. **中央大脑 = 跨域协同**
   章鱼的中央大脑协调所有触手。OpenOctopus Core 让所有 Realm 的信息互联互通。

### 6.3 Realm Matrix（12 域）

| Realm | Icon | 典型实体 | 示例 Agent |
|---|---|---|---|
| Pet | 🐾 | 宠物、兽医、食品 | Health advisor, **Momo** (summoned) |
| Parents | 👨‍👩‍👦 | 父母、健康档案 | Care assistant, **Mom** (summoned) |
| Partner | ❤️ | 伴侣、纪念日 | Relationship advisor |
| Finance | 💰 | 账户、投资、负债 | Budget planner, tax assistant |
| Work | 💼 | 项目、同事、目标 | Task manager, weekly reporter |
| Legal | ⚖️ | 合同、案件、法条 | Contract lawyer |
| Vehicle | 🚗 | 车、保险、维保 | Maintenance tracker |
| Home | 🏠 | 房屋、家电、装修 | Home manager |
| Health | 🏥 | 体检、处方、病历 | Health monitor |
| Fitness | 🏋️ | 训练计划、身体数据 | Fitness coach |
| Hobby | 🎨 | 爱好项目、学习资料 | Learning coach |
| Friends | 👥 | 社交圈、社交事件 | Social radar |

### 6.4 Summon 演示（出差场景）

```
You:  "I'm traveling for 5 days next week."

🐾 Momo (Pet):     "Who's going to feed me and walk me for 5 days?!"
👩 Mom (Parents):   "Mom just said she'd like to visit — she could take care of Momo."
🚗 Car (Vehicle):   "Charge to full before departure? Or take a taxi to the airport?"
💰 Budget (Finance): "Trip budget estimate: ¥X. Remember to save receipts."

→ 🐙 System compiles a "Trip Prep Checklist" for your approval.
```

### 6.5 功能列表（6 Features）

1. **Realm Matrix** — Grid dashboard of all life realms, health scores, risks, and to-dos at a glance.
2. **Summon** — Turn any entity (pet, person, asset) into an AI agent that remembers, speaks, and acts.
3. **Cross-Realm Intelligence** — Knowledge graph connects all realms; your pet realm knows your finance budget.
4. **Dual-layer Skills** — Global skills (search, calendar, email) + realm skills (vet lookup, tax calc, law search).
5. **Agent Teams** — Professional agents + summoned agents collaborate within each realm.
6. **Local-first** — SQLite by default, optional cloud sync. Your data, your tentacles.

### 6.6 竞品对比

| 能力 | ChatGPT | Notion AI | AutoGPT | **OpenOctopus** |
|---|---|---|---|---|
| 分域管理 | ❌ 单一对话 | ⚠️ 手动分页 | ❌ 单一目标 | ✅ **Realm Matrix** |
| 实体召唤 | ❌ | ❌ | ❌ | ✅ **Summon** |
| 长期记忆 | ⚠️ 有限 | ⚠️ 文档内 | ❌ | ✅ 分域持久记忆 |
| 多 Agent 协作 | ❌ | ❌ | ⚠️ 顺序执行 | ✅ 跨域并行 |
| 知识图谱 | ❌ | ❌ | ❌ | ✅ 跨域实体关联 |
| 本地优先 | ❌ 云端 | ❌ 云端 | ✅ | ✅ SQLite |
| 开源 | ❌ | ❌ | ✅ | ✅ MIT |
| 域包市场 | ❌ | ❌ | ❌ | ✅ **RealmHub** |

### 6.7 RealmHub

"Like an app store, but for life domains."

示例域包：
- **Legal Advisor Team** — entity templates + 3 agents + skills
- **Pet Care** — pet profile + health advisor + vaccination tracker
- **Family Finance** — accounts + budget planner + investment analyzer

### 6.8 Quick Start

```bash
# Install
npm i -g openoctopus

# Initialize your life system
tentacle init

# Create your first realm
tentacle realm create pet --template default

# Summon your first entity
tentacle summon --realm pet --name "Momo" --type living
```

### 6.9 生态命名

| 组件 | 命名 | 隐喻 |
|---|---|---|
| Realm 市场 | **RealmHub** | 域能力集散中心 |
| CLI 工具 | **tentacle** | 触手 = 命令行延伸 |
| Agent 网关 | **ink** | 墨汁 = 信息流通介质 |
| 召唤引擎 | **summon** | 核心功能 |
| 社区 | **The Reef** | 珊瑚礁 = 章鱼栖息地 |
| 域配置文件 | **REALM.md** | 域定义 |
| 实体人格文件 | **SOUL.md** | 召唤体性格定义 |
| 贡献者 | **tentaclers** | 触手们 |

### 6.10 技术栈

| 层 | 选型 |
|---|---|
| Runtime | Node.js >= 22 + TypeScript 5.7+ (strict) |
| Package Manager | pnpm (workspaces) |
| Bundler | tsdown |
| Test | Vitest 4 |
| DB | SQLite (local) / PostgreSQL (optional sync) |
| Gateway | Express 5 (HTTP) + WebSocket RPC (ws) |
| LLM | Anthropic, OpenAI, Google, Ollama (multi-provider + failover) |
| Channels | Telegram, Discord, Slack (plugin architecture) |
| CLI | citty + consola + WS RPC |

---

## 7. 社交链接

| 平台 | 链接 |
|---|---|
| 官网 | `https://openoctopus.club` |
| GitHub（产品） | `https://github.com/open-octopus/openoctopus` |
| GitHub（网站） | `https://github.com/open-octopus/openoctopus.club` |
| Discord | `https://discord.gg/mwNTk8g5fV`（The Reef） |
| X/Twitter | `@openoctopus` |
| Product Hunt | 待注册 |
| 小红书 | 待注册 |
| 知乎 | 待注册 |
| TikTok | 待注册 |
| npm | `openoctopus` |
| Email | `hello@openoctopus.club` |

---

## 8. SEO & Open Graph

### 8.1 Meta Tags

```html
<title>OpenOctopus — Organize life by realms. Summon anything into a living agent.</title>
<meta name="description" content="Realm-native life agent system. Organize your life into autonomous domains, each with its own knowledge base, agent team, and skill set. Turn any entity into a living AI agent with Summon.">
<meta name="keywords" content="AI agent, life management, realm, summon, personal assistant, knowledge base, local-first, open source">
```

### 8.2 Open Graph

```html
<meta property="og:title" content="OpenOctopus — Realm-native Life Agent System">
<meta property="og:description" content="Organize life by realms. Summon anything into a living agent. Eight arms, every realm covered.">
<meta property="og:image" content="/og-image.png"> <!-- 使用 banner.png -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://openoctopus.ai">
```

### 8.3 Twitter Card

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@openoctopus">
<meta name="twitter:title" content="OpenOctopus — SUMMON!">
<meta name="twitter:description" content="Organize life by realms. Summon anything into a living agent.">
<meta name="twitter:image" content="/og-image.png">
```

---

## 9. 技术实现（已完成）

### 9.1 项目结构

```
openoctopus.club/
├── .github/workflows/deploy.yml   # GitHub Pages CI/CD（备用）
├── public/
│   ├── favicon.png                # 像素风章鱼
│   ├── og-image.png               # 社交分享预览图
│   └── CNAME                      # 自定义域名
├── src/
│   ├── assets/
│   │   ├── brand/                 # 品牌素材（7 + 4 张 AI 生成）
│   │   ├── architecture/          # 架构图（4 张）
│   │   └── infographics/          # 信息图（3 张）
│   ├── components/                # 16 个 Astro 组件
│   │   ├── Header.astro           # 粘顶导航 + 移动端菜单
│   │   ├── ThemeToggle.astro      # 深色/浅色切换
│   │   ├── Hero.astro             # 深海背景 + SUMMON! + CTA
│   │   ├── ThreeMetaphors.astro   # 八臂/发光/大脑三隐喻
│   │   ├── RealmMatrix.astro      # 12 域 4x3 卡片网格
│   │   ├── Summon.astro           # 概念图 + 变身序列 + 对话演示
│   │   ├── HowItWorks.astro       # 三步流程
│   │   ├── Features.astro         # 6 功能 SVG 图标卡片
│   │   ├── Comparison.astro       # 象限图 + 对比表
│   │   ├── RealmHub.astro         # 3 域包示例
│   │   ├── QuickStart.astro       # 终端风格命令
│   │   ├── Architecture.astro     # 彩色 ASCII 架构图
│   │   ├── Ecosystem.astro        # 7 组件命名卡片
│   │   ├── Octo.astro             # 吉祥物浮动动画
│   │   ├── Community.astro        # 社交链接
│   │   └── Footer.astro           # 页脚
│   ├── layouts/Layout.astro       # HTML Shell + SEO + OG + 主题初始化
│   ├── pages/index.astro          # 主页（组装 14 个区块）
│   └── styles/global.css          # Tailwind base + .card/.btn-*/.gradient-text
├── astro.config.mjs               # site: openoctopus.club, static output
├── tailwind.config.mjs            # 品牌色 + light: variant plugin
├── package.json
└── tsconfig.json
```

### 9.2 主题切换实现

使用 Tailwind `darkMode: 'class'` 反转模式：暗色为默认，`html.light` 激活亮色。

自定义 Tailwind variant：
```js
plugins: [function ({ addVariant }) {
  addVariant('light', 'html.light &');
}]
```

FOUC 防止：`<head>` 中同步读取 `localStorage('oo-theme')` 设置 class。

### 9.3 部署配置（当前）

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
export default defineConfig({
  site: 'https://openoctopus.club',
  output: 'static',
  integrations: [tailwind()],
});
```

部署方式：Vercel + GitHub 集成，push 到 main 自动部署。

---

## 10. 与 OpenClaw 的对应关系

| OpenClaw 网站元素 | OpenOctopus 对应 |
|---|---|
| Molty 龙虾吉祥物 | Octo 章鱼吉祥物 |
| "The AI that actually does things" | "Organize life by realms. Summon anything into a living agent." |
| 安装方式 (npm/git/brew) | `npm i -g openoctopus` / `tentacle init` |
| 功能展示 (runs locally, multi-platform...) | Realm Matrix / Summon / Cross-Realm / Local-first |
| 集成矩阵 (40+ platforms) | Realm Matrix (12 domains) + Ecosystem (7 components) |
| ClawHub | RealmHub |
| Discord: clawd | Discord: The Reef |
| 红色主调 | 紫色(#6C3FA0) + 青色(#00D4AA) 主调 |
| 深色主题优先 | 深色主题优先（深海主题） |

---

## 11. 核心产品概念速查

### 11.1 五大基础概念

| 概念 | 一句话定义 |
|---|---|
| **Realm** | 自治的人生域，像章鱼触手一样独立运转 |
| **Entity** | 域中的对象：living(人/宠物)、asset(车/房)、organization、abstract(目标/项目) |
| **Summon** | 将 Entity 召唤为有记忆、性格、主动行为的 AI Agent |
| **Agent** | Central(路由/协调/调度) + Realm(专业) + Summoned(召唤体) 三层 |
| **Skill** | Global(搜索/日历/邮件) + Realm(兽医查询/税务计算) 双层 |

### 11.2 与 OpenClaw 核心差异

| 维度 | OpenClaw | OpenOctopus |
|---|---|---|
| 核心抽象 | Tool / Skill / Agent Runtime | **Realm → Entity → Summon → Agent** |
| 组织方式 | 按能力和工具连接 | **按人生域矩阵分类** |
| 差异化功能 | 自动化执行 | **Summon（召唤）** |
| 分享市场 | ClawHub（技能粒度） | **RealmHub（域包粒度）** |
| 比喻 | 一把瑞士军刀 | 一只章鱼，八臂并行 |

### 11.3 SOUL.md 示例（Summon 配置）

```yaml
# SOUL.md — 召唤体人格定义文件
name: Momo
type: living
personality:
  tone: 活泼好动、偶尔撒娇
  speaking_style: 短句、带语气词、偶尔用 emoji
  traits: [贪吃, 怕打雷, 爱游泳, 粘人]
proactive:
  triggers:
    - condition: "疫苗到期前 2 周"
      action: "提醒主人预约兽医"
    - condition: "气温 > 35°C"
      action: "提醒避免中午遛狗"
  schedule:
    - cron: "0 8 * * *"
      action: "早安问候 + 今日天气提醒"
```

---

## 12. Badge 规范

```html
<p align="center">
  <a href="https://github.com/open-octopus/openoctopus">
    <img src="https://img.shields.io/github/stars/open-octopus/openoctopus?style=for-the-badge" alt="Stars">
  </a>
  <a href="https://discord.gg/mwNTk8g5fV">
    <img src="https://img.shields.io/badge/Discord-The%20Reef-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord">
  </a>
  <a href="https://github.com/open-octopus/openoctopus/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License">
  </a>
</p>
```
