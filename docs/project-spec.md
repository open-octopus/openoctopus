# OpenOctopus 项目定位与大纲

## 1. 命名

| | 名称 |
|---|---|
| 中文名 | Open八爪鱼 |
| 英文名 | **OpenOctopus**（推荐） |
| 备选 | OctoOpen（偏技术品牌）、OpenOcta（更短） |

**一句话定位：** OpenOctopus is an area-native life agent system.

## 2. 核心产品定义

Open八爪鱼是一个 **Area Native** 的人生助理 Agent 系统。

与传统 AI 助手不同，它不是一个统一聊天框，而是以 **Area（人生域）** 为核心组织单元：

- 宠物域、父母域、朋友域
- 金融域、工作域、兴趣域
- 以及用户自定义域

每个 Area 都可以沉淀资料、抽取实体、创建 Agent 团队，并持续产生分析与行动建议。

## 3. 与 OpenClaw 的关系与差异

| 维度 | OpenClaw | OpenOctopus |
|---|---|---|
| 核心抽象 | Tool / Skill / Agent Runtime | Area -> Entity -> Agent Team |
| 用户入口 | 任务执行与自动化 | 人生资料沉淀与分域治理 |
| 组织方式 | 按能力和工具连接 | 按人生域矩阵分类（Area Matrix） |
| 分享机制 | ClawHub 分享技能 | AreaHub 分享完整域包（实体 + Agent + 技能） |
| 目标 | 通用自动化执行 | 个人长期知识与行动系统 |

## 4. AreaHub：域能力分享市场

参考 OpenClaw 的 ClawHub，OpenOctopus 提供 **AreaHub**。

### 4.1 分享对象

用户可以分享一个完整 Area 包，而不是单个技能：

- **Area 模板** — 字段结构、数据视图、仪表盘
- **实体模板** — 如"律师""案件""法条""合同"
- **Agent 团队** — 分析 Agent、计划 Agent、审查 Agent
- **工作流技能** — 提醒、审阅、知识检索、报告生成

### 4.2 一键获取

其他用户可以一键安装 Area 包，例如：

- 法律顾问团队（Legal Advisor Team）
- 家庭健康管理域
- 个人财务投顾域
- 宠物照护域

### 4.3 包管理机制

- **area package** — 版本号、依赖、权限声明
- **安装前预览** — 将创建哪些实体、哪些 Agent、需要哪些外部连接
- **安装后可编辑** — 模板变成"我的域副本"，可深度改造

## 5. 信息架构

```
Area -> Entity -> Agent Team -> Skill -> Action / Insight
```

| 概念 | 说明 |
|---|---|
| Area | 人生域 |
| Entity | 该域中的对象（人、事、资产、目标、事件） |
| Agent | 围绕 Entity 或 Area 运行的智能体 |
| Skill | Agent 可调用的能力 |
| Memory | 长期记忆与历史轨迹 |
| Action | 待执行动作（可人工确认） |
| Insight | 洞察、风险、建议 |

## 6. 产品模块（MVP）

### 6.1 Area Matrix 首页

- 网格化展示所有人生域
- 每个 Area 显示健康度、风险数、待办数、最近更新

### 6.2 Area 工作台

- 资料录入与结构化整理
- 实体自动抽取（从笔记 / 聊天 / 文档中提取）
- Area 级分析报告（周报 / 月报）

### 6.3 Entity Agent 团队

- 为关键实体创建专属 Agent
- 支持多 Agent 协作（分析、反证、执行计划）

### 6.4 AreaHub

- 浏览、安装、发布 Area 包
- 一键导入"法律顾问团队"等现成方案

### 6.5 治理与安全

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
| 客户端 | Web Dashboard（Area Matrix）+ CLI（自动化和运维） |
| 数据层 | SQLite（本地）+ PostgreSQL / Supabase（可选同步） |
| 向量检索 | pgvector 或本地向量库（按 Area 分片） |
| 插件机制 | Skill 机制 + Area Package 规范 |

## 8. 里程碑

### Milestone 1（2-3 周）

- 完成 Area Matrix + 6 个默认 Area
- 完成基础录入与实体抽取

### Milestone 2（2-3 周）

- 完成 Area 内 Agent 团队与分析报告
- 完成关键动作审批与日志

### Milestone 3（2-3 周）

- 上线 AreaHub（导入优先，发布次之）
- 提供 3 个官方 Area 包（法律顾问 / 财务 / 家庭）

## 9. 对外传播文案

- **中文** — Open八爪鱼：把人生拆成多个域，让每个域都有自己的 AI 团队。
- **英文** — OpenOctopus: Organize life by areas, power each area with its own agent team.
