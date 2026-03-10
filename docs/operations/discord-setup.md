# Discord 社区创建指南（The Reef）

## 1. 基础信息

| 项目 | 内容 |
|---|---|
| Server Name | **The Reef 🐙** |
| Icon | `docs/assets/openoctopus-avatar.png` |
| Banner | `docs/assets/openoctopus-banner.png` |
| Description | Official community for OpenOctopus — the realm-native life agent system. |
| Invite Link | `discord.gg/openoctopus` (Vanity URL，需 Boost Level 3) |
| 语言 | 中英双语（中文为主，英文频道预留） |

## 2. Server 创建步骤

### 2.1 创建 Server

1. Discord → 左侧 "+" → Create My Own → For a community
2. 填写 Server Name：`The Reef 🐙`
3. 上传 Server Icon：使用 `openoctopus-avatar.png`
4. 创建完成后 → Server Settings → Overview → Upload Banner

### 2.2 开启 Community 功能

1. Server Settings → Enable Community
2. 设置 Rules Channel：`#rules`
3. 设置 Updates Channel：`#announcements`
4. 开启 Welcome Screen

### 2.3 Welcome Screen 配置

```
Welcome to The Reef! 🐙

The official OpenOctopus community.
Organize life by realms. Summon anything into a living agent.
```

**推荐频道引导（最多 5 个）：**

| 频道 | 描述 |
|---|---|
| `#rules` | 社区规则，先读这里 |
| `#general` | 日常讨论，自由聊天 |
| `#showcase` | 展示你的 Realm 和 Summon 体验 |
| `#dev-general` | 开发者讨论 |
| `#setup-help` | 安装和使用问题 |

## 3. 频道结构

### 3.1 INFO（信息区）

| 频道 | 类型 | 权限 | 说明 |
|---|---|---|---|
| `#rules` | 文字 | 只读 | 社区规则 |
| `#announcements` | 公告 | 只读 | 官方公告、版本发布 |
| `#roadmap` | 文字 | 只读 | 开发路线图与进展 |

### 3.2 GENERAL（通用区）

| 频道 | 类型 | 说明 |
|---|---|---|
| `#general` | 文字 | 日常讨论 |
| `#introductions` | 文字 | 新人自我介绍 |
| `#showcase` | 文字 | 展示你的 Realm 配置、Summon 截图、使用心得 |
| `#ideas` | 文字 | 功能建议与讨论 |
| `#off-topic` | 文字 | 闲聊 |

### 3.3 REALMS（域讨论区）

| 频道 | 说明 |
|---|---|
| `#realm-pet` | 宠物域讨论 |
| `#realm-family` | 家庭 / 父母 / 爱人域 |
| `#realm-finance` | 金融 / 理财域 |
| `#realm-work` | 工作域 |
| `#realm-legal` | 法律域 |
| `#realm-health` | 健康 / 运动域 |
| `#realm-custom` | 自定义域讨论 |

### 3.4 SUMMON（召唤区）

| 频道 | 说明 |
|---|---|
| `#summon-showcase` | 晒你的召唤体（Momo、妈妈、爱车……） |
| `#entity-design` | 讨论实体设计、SOUL.md 写法、性格调校 |
| `#summon-ideas` | 召唤功能的想法与需求 |

### 3.5 DEV（开发区）

| 频道 | 说明 |
|---|---|
| `#dev-general` | 开发者通用讨论 |
| `#tentacle-cli` | CLI 工具开发 |
| `#ink-gateway` | Agent 网关开发 |
| `#realmhub` | RealmHub 域包市场 |
| `#contributions` | PR 讨论、Code Review |

### 3.6 HELP（帮助区）

| 频道 | 说明 |
|---|---|
| `#setup-help` | 安装与配置问题 |
| `#bug-reports` | Bug 报告 |
| `#feature-requests` | 功能需求（Forum 类型） |

### 3.7 VOICE（语音区）

| 频道 | 说明 |
|---|---|
| `🔊 General Voice` | 通用语音 |
| `🔊 Dev Standup` | 开发者站会 |

## 4. 角色（Roles）设计

| 角色 | 颜色 | 说明 |
|---|---|---|
| `@Octo Core` | `#6C3FA0`（紫色） | 核心团队 |
| `@Tentacler` | `#00D4AA`（青色） | 代码贡献者 |
| `@Realm Builder` | `#1E3A5F`（深蓝） | Realm 包贡献者 |
| `@Summoner` | `#FFD700`（金色） | 活跃的召唤体创作者 |
| `@Reef Member` | 默认灰 | 普通成员 |

## 5. Bot 配置

### 5.1 推荐 Bot

| Bot | 用途 |
|---|---|
| **MEE6** 或 **Carl-bot** | 自动角色分配、等级系统、欢迎消息 |
| **GitHub Bot** | 同步 GitHub 通知到 `#announcements` |
| **Disboard** | 增加社区曝光 |

### 5.2 欢迎消息模板

```
🐙 Welcome to The Reef, {user}!

You've just entered the OpenOctopus community.

Quick start:
📜 Read the #rules first
💬 Introduce yourself in #introductions
🎯 Check out #showcase to see what others are building
🛠️ Devs → head to #dev-general

SUMMON! 🐙
```

### 5.3 GitHub 通知 Webhook

1. GitHub repo → Settings → Webhooks → Add webhook
2. Payload URL：Discord Webhook URL（从 `#announcements` 频道设置获取）
3. Content type：`application/json`
4. Events：Releases, Issues, Pull Requests

## 6. 社区规则模板（#rules 频道）

```
🐙 The Reef — Community Rules

1. Be respectful. Treat others as you would treat a friendly octopus.
2. Stay on topic. Use the right channel for your message.
3. No spam, self-promotion, or advertising without permission.
4. No NSFW content.
5. Help others. Share knowledge, not judgement.
6. English and Chinese are both welcome.
7. Report issues to @Octo Core or use ModMail.

Violations → warning → mute → ban.

SUMMON responsibly! 🐙
```

## 7. 运营节奏

| 频率 | 活动 | 频道 |
|---|---|---|
| 每次发版 | Release Notes 公告 | `#announcements` |
| 每周 | "本周 Realm 精选" — 选出最佳 showcase | `#showcase` |
| 每两周 | Dev Standup 语音会（30 min） | `🔊 Dev Standup` |
| 每月 | "Summon of the Month" — 最佳召唤体评选 | `#summon-showcase` |
| 不定期 | AMA（Ask Me Anything）| `#general` |

## 8. 增长策略

1. **README 入口**：GitHub README 的 Discord badge 直链到 invite
2. **GitHub Issue → Discord**：issue 中引导深度讨论到 Discord
3. **Showcase 激励**：优秀 showcase 在 GitHub README 或 Twitter 中展示
4. **Realm Package 作者**：RealmHub 贡献者自动获得 `@Realm Builder` 角色
5. **跨平台同步**：Discord 精华内容同步到 X / 小红书
