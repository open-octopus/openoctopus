# OpenOctopus（Open八爪鱼）

> 把人生拆成多个域，让每个域都有自己的 AI 团队。
>
> *Organize life by areas, power each area with its own agent team.*

OpenOctopus 是一个 **Area Native** 的人生助理 Agent 系统。

它不是一个统一聊天框，而是以 **Area（人生域）** 为核心组织单元——宠物域、父母域、金融域、工作域、兴趣域……每个 Area 都可以沉淀资料、抽取实体、创建 Agent 团队，并持续产生分析与行动建议。

## 核心模型

```
Area -> Entity -> Agent Team -> Skill -> Action / Insight
```

| 概念 | 说明 |
|---|---|
| **Area** | 人生域（宠物、家庭、金融、工作……） |
| **Entity** | 域中的对象（人、事、资产、目标、事件） |
| **Agent** | 围绕 Entity 或 Area 运行的智能体 |
| **Skill** | Agent 可调用的能力 |
| **Memory** | 长期记忆与历史轨迹 |
| **Action** | 待执行动作（可人工确认） |
| **Insight** | 洞察、风险、建议 |

## 产品模块（MVP）

| 模块 | 说明 |
|---|---|
| **Area Matrix** | 网格化展示所有人生域，显示健康度、风险数、待办数 |
| **Area Workbench** | 资料录入、实体自动抽取、Area 级分析报告 |
| **Agent Team** | 为关键实体创建专属 Agent，支持多 Agent 协作 |
| **AreaHub** | 浏览、安装、发布 Area 包（如"法律顾问团队"） |
| **Governance** | 关键动作人工确认、全量日志审计、隐私与权限分级 |

## 技术栈

| 层 | 选型 |
|---|---|
| 运行时 | Node.js >= 22 + TypeScript |
| 网关 | 统一编排入口（参考 OpenClaw Gateway） |
| 客户端 | Web Dashboard（Area Matrix）+ CLI |
| 数据 | SQLite（本地优先）+ PostgreSQL / Supabase（可选同步） |
| 向量检索 | pgvector / 本地向量库（按 Area 分片） |
| 插件 | Skill 机制 + Area Package 规范 |

## 与 OpenClaw 的差异

| 维度 | OpenClaw | OpenOctopus |
|---|---|---|
| 核心抽象 | Tool / Skill / Agent Runtime | Area -> Entity -> Agent Team |
| 用户入口 | 任务执行与自动化 | 人生资料沉淀与分域治理 |
| 组织方式 | 按能力和工具连接 | 按人生域矩阵分类（Area Matrix） |
| 分享机制 | ClawHub 分享技能 | AreaHub 分享完整域包（实体 + Agent + 技能） |
| 目标 | 通用自动化执行 | 个人长期知识与行动系统 |

## 文档

| 文档 | 说明 |
|---|---|
| [项目定位与大纲](docs/project-spec.md) | 命名、AreaHub 机制、信息架构、里程碑 |
| [设计讨论与深化](docs/design-discussion.md) | Realm 命名、实体化机制、分层架构、跨域协调、与 OpenClaw 差异 |
| [品牌设计](docs/branding.md) | 标语、色彩、吉祥物、Logo 生图提示词、生态命名 |
| [调研资料索引](docs/research/README.md) | AI Native 外部信号、场景图谱、路线图、参考来源 |

## License

MIT
