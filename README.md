# OpenOctopus（Open八爪鱼）

> 把人生分域治理，把万物召唤为 Agent，八臂并行，一脑协同。
>
> *Organize life by realms. Summon anything into a living agent.*

OpenOctopus 是一个 **Realm-native** 的人生助理 Agent 系统。

它不是一个统一聊天框，而是以 **Realm（人生域）** 为核心组织单元——宠物域、父母域、金融域、工作域、兴趣域……每个 Realm 拥有独立的知识库、Agent 团队和技能集，如同章鱼的每条触手都有自己的神经中枢。

更独特的是 **Summon（召唤）**：将你生活中的任何对象——宠物、家人、爱车——召唤为有记忆、有性格、可主动行动的 AI Agent。

## 核心模型

```
Realm -> Entity -> [Summon] -> Agent Team -> Skill -> Action / Insight
```

| 概念 | 说明 |
|---|---|
| **Realm** | 人生域（宠物、家庭、金融、工作……），自治运转的知识领地 |
| **Entity** | 域中的对象（人、宠物、资产、目标、事件） |
| **Summon** | 将 Entity 召唤为有性格、有记忆、可主动行动的 Agent |
| **Agent** | 围绕 Entity 或 Realm 运行的智能体（专业型 / 召唤型） |
| **Skill** | Agent 可调用的能力（全局 Skill + 域 Skill） |
| **Memory** | 长期记忆与历史轨迹 |
| **Action** | 待执行动作（可人工确认） |
| **Insight** | 洞察、风险、建议 |

## 产品模块（MVP）

| 模块 | 说明 |
|---|---|
| **Realm Matrix** | 网格化展示所有人生域，显示健康度、风险数、待办数 |
| **Realm Workbench** | 资料录入、实体自动抽取、域级分析报告 |
| **Summon** | 将实体召唤为可交互的 Agent，支持模拟对话与主动行动 |
| **Agent Team** | 域内专业 Agent + 召唤 Agent，支持多 Agent 协作 |
| **RealmHub** | 浏览、安装、发布 Realm 包（如"法律顾问团队"） |
| **Governance** | 关键动作人工确认、全量日志审计、隐私与权限分级 |

## 技术栈

| 层 | 选型 |
|---|---|
| 运行时 | Node.js >= 22 + TypeScript |
| 网关 | 统一编排入口（参考 OpenClaw Gateway） |
| 客户端 | Web Dashboard（Realm Matrix）+ CLI |
| 数据 | SQLite（本地优先）+ PostgreSQL / Supabase（可选同步） |
| 向量检索 | pgvector / 本地向量库（按 Realm 分片） |
| 插件 | Skill 机制 + Realm Package 规范 |

## 与 OpenClaw 的差异

| 维度 | OpenClaw | OpenOctopus |
|---|---|---|
| 核心抽象 | Tool / Skill / Agent Runtime | Realm -> Entity -> Summon -> Agent |
| 用户入口 | 任务执行与自动化 | 人生资料沉淀与分域治理 |
| 组织方式 | 按能力和工具连接 | 按人生域矩阵分类（Realm Matrix） |
| 差异化功能 | 自动化执行 | **Summon（召唤）** — 万物皆可 Agent |
| 分享机制 | ClawHub 分享技能 | RealmHub 分享完整域包 |
| 比喻 | 一把瑞士军刀 | 一只章鱼，八臂并行 |

## 文档

| 文档 | 说明 |
|---|---|
| [项目定位与大纲](docs/project-spec.md) | 命名、RealmHub 机制、信息架构、里程碑 |
| [设计讨论与深化](docs/design-discussion.md) | Realm 命名、Summon 机制、分层架构、跨域协调 |
| [品牌设计](docs/branding.md) | 标语、色彩、吉祥物、Logo 生图提示词、生态命名 |
| [调研资料索引](docs/research/README.md) | AI Native 外部信号、场景图谱、路线图、参考来源 |

## License

MIT
