# OpenOctopus 项目定位与大纲

<p align="center">
  <img src="images/信息图/OpenOctopus：AI人生治理范式.png" alt="OpenOctopus：AI 人生治理范式" width="720">
</p>

## 1. 命名

| | 名称 |
|---|---|
| 中文名 | Open八爪鱼 |
| 英文名 | **OpenOctopus**（推荐） |
| 备选 | OctoOpen（偏技术品牌）、OpenOcta（更短） |

**一句话定位：** OpenOctopus — Organize life by realms. Summon anything into a living agent.

## 2. 核心产品定义

Open八爪鱼是一个 **Realm-native** 的人生助理 Agent 系统。

与传统 AI 助手不同，它不是一个统一聊天框，而是以 **Realm（人生域）** 为核心组织单元：

- 宠物域、父母域、朋友域
- 金融域、工作域、兴趣域
- 以及用户自定义域

每个 Realm 拥有独立的知识库、Agent 团队和技能集。

更独特的是 **Summon（召唤）**——将实体召唤为有记忆、有性格、可主动行动的 Agent，让生活中的每个重要对象都拥有"数字生命"。

## 3. 与 OpenClaw 的关系与差异

| 维度 | OpenClaw | OpenOctopus |
|---|---|---|
| 核心抽象 | Tool / Skill / Agent Runtime | Realm -> Entity -> Summon -> Agent |
| 用户入口 | 任务执行与自动化 | 人生资料沉淀与分域治理 |
| 组织方式 | 按能力和工具连接 | 按人生域矩阵分类（Realm Matrix） |
| 分享机制 | ClawHub 分享技能 | RealmHub 分享完整域包（实体 + Agent + 技能） |
| 差异化功能 | 自动化执行 | Summon（召唤）— 万物皆可 Agent |
| 目标 | 通用自动化执行 | 个人长期知识与行动系统 |

## 4. RealmHub：域能力分享市场

参考 OpenClaw 的 ClawHub，OpenOctopus 提供 **RealmHub**。

### 4.1 分享对象

用户可以分享一个完整 Realm 包，而不是单个技能：

- **Realm 模板** — 字段结构、数据视图、仪表盘
- **实体模板** — 如"律师""案件""法条""合同"
- **Agent 团队** — 分析 Agent、计划 Agent、审查 Agent
- **工作流技能** — 提醒、审阅、知识检索、报告生成

### 4.2 一键获取

其他用户可以一键安装 Realm 包，例如：

- 法律顾问团队（Legal Advisor Team）
- 家庭健康管理域
- 个人财务投顾域
- 宠物照护域

### 4.3 包管理机制

- **realm package** — 版本号、依赖、权限声明
- **安装前预览** — 将创建哪些实体、哪些 Agent、需要哪些外部连接
- **安装后可编辑** — 模板变成"我的域副本"，可深度改造

## 5. 信息架构

```
Realm -> Entity -> [Summon] -> Agent Team -> Skill -> Action / Insight
```

| 概念 | 说明 |
|---|---|
| Realm | 人生域，自治运转的知识领地 |
| Entity | 该域中的对象（人、宠物、资产、目标、事件） |
| Summon | 将 Entity 召唤为有性格、有记忆、可主动行动的 Agent |
| Agent | 围绕 Entity 或 Realm 运行的智能体（专业型 / 召唤型） |
| Skill | Agent 可调用的能力（Global Skill + Realm Skill） |
| Memory | 长期记忆与历史轨迹 |
| Action | 待执行动作（可人工确认） |
| Insight | 洞察、风险、建议 |

## 6. 产品模块（MVP）

### 6.1 Realm Matrix 首页

- 网格化展示所有人生域
- 每个 Realm 显示健康度、风险数、待办数、最近更新

### 6.2 Realm 工作台

- 资料录入与结构化整理
- 实体自动抽取（从笔记 / 聊天 / 文档中提取）
- Realm 级分析报告（周报 / 月报）

### 6.3 Summon 召唤

- 将实体召唤为可交互的 Agent
- 赋予性格、记忆、主动行为能力
- 支持召唤体之间的对话与协作

### 6.4 Agent Team

- 域内专业 Agent（法律顾问、财务分析师……）
- 召唤 Agent（Momo、妈妈、我的车……）
- 支持多 Agent 协作（分析、反证、执行计划）

### 6.5 RealmHub

- 浏览、安装、发布 Realm 包
- 一键导入"法律顾问团队"等现成方案

### 6.6 治理与安全

- 关键动作默认人工确认
- 全量日志和审计
- 隐私策略与权限分级

## 7. 风格与技术栈

### 7.1 产品风格

- **气质** — 工程化、可扩展、可审计
- **交互** — 命令式 + 可视化矩阵并存（CLI + Dashboard）
- **架构** — 本地优先（Local-first）+ 可选云同步

### 7.2 技术栈

| 层 | 选型 |
|---|---|
| 运行时 | Node.js >= 22 + TypeScript |
| Agent 网关 | 参考 OpenClaw Gateway，统一编排入口 |
| 客户端 | Web Dashboard（Realm Matrix）+ CLI（自动化和运维） |
| 数据层 | SQLite（本地）+ PostgreSQL / Supabase（可选同步） |
| 向量检索 | pgvector 或本地向量库（按 Realm 分片） |
| 插件机制 | Skill 机制 + Realm Package 规范 |

## 8. 里程碑

### Milestone 1（2-3 周）

- 完成 Realm Matrix + 6 个默认 Realm
- 完成基础录入与实体抽取

### Milestone 2（2-3 周）

- 完成 Summon 召唤机制
- 完成 Realm 内 Agent 团队与分析报告
- 完成关键动作审批与日志

### Milestone 3（2-3 周）

- 上线 RealmHub（导入优先，发布次之）
- 提供 3 个官方 Realm 包（法律顾问 / 财务 / 家庭）

## 9. 对外传播文案

- **中文** — Open八爪鱼：把人生分域治理，把万物召唤为 Agent。
- **英文** — OpenOctopus: Organize life by realms. Summon anything into a living agent.
