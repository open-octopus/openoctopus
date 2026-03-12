# OpenOctopus 项目待办清单

> 更新时间：2026-03-11

## 基础设施

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| 1 | **注册域名** | ⬜ | 立即注册 `openoctopus.io`、`realmhub.ai`、`openoctopus.dev`（见 domain-strategy.md） |
| 2 | **确认 openoctopus.ai** | ⬜ | 确认是否为自有域名，若是则配置 DNS + SSL |
| 3 | **GitHub Repo 设置** | ⬜ | 设置 About 描述、Topics、Social Preview 图片（用 banner.png），按 social-profiles.md 配置 |
| 4 | **GitHub Org Profile** | ⬜ | 创建 `open-octopus/.github` 仓库，添加 `profile/README.md` 组织介绍页 |
| 5 | **注册社媒账号** | ⬜ | X `@openoctopus`、小红书「Open八爪鱼」、即刻、Discord Server |

## 工程脚手架 ✅

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| 6 | **Monorepo 初始化** | ✅ | 8 个 packages（shared/storage/core/summon/channels/ink/tentacle/realmhub），pnpm workspaces |
| 7 | **CI/CD 配置** | ⬜ | 待配置 `.github/` workflows（lint、test、build） |
| 8 | **Core Package 结构** | ✅ | Router, RealmManager, EntityManager, AgentRunner, LLM Registry 等 12 模块 |
| 9 | **数据库 Schema** | ✅ | SQLite v1 + v2 迁移: realms, entities, memories, agents, audit_log, scanned_files, health_reports, onboarding_state 等 |
| 10 | **CLI (`tentacle`) 骨架** | ✅ | WS RPC 流式聊天 + TUI 渲染 + slash commands + HTTP 回退 |

## 产品 MVP — Phase 1 ✅

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| 11 | **Realm CRUD** | ✅ | 创建/编辑/删除 Realm + REALM.md 解析加载 + 12 个预配 Realm |
| 12 | **Entity CRUD + Summon** | ✅ | Entity 录入 + SOUL.md 解析 + SummonEngine 激活/释放 + 分层记忆 Prompt |
| 13 | **Router Agent** | ✅ | LLM 意图路由 + 12 域中英关键词回退 + 置信度分数 |
| 14 | **Realm Agent 对话** | ✅ | 域内 Agent 对话 + JSONL 会话持久化 + 域记忆注入 System Prompt |
| 15 | **Web Dashboard** | ⬜ | Phase 2 实现 |

## 知识生命周期 — Phase 1.5 ✅

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| 16 | **知识分发与冷启动** | ✅ | KnowledgeDistributor: LLM + 关键词双路径，多步对话引导 |
| 17 | **成熟度巡检** | ✅ | MaturityScanner: 加权评分公式，阈值 60 建议召唤 |
| 18 | **跨域反应** | ✅ | CrossRealmReactor: 异步关键词匹配 + LLM 生成反应 |
| 19 | **目录扫描** | ✅ | DirectoryScanner: 递归扫描 + SHA256 增量 + 自动注入 |
| 20 | **记忆健康** | ✅ | MemoryHealthManager: 去重/过期/矛盾/压缩 + 健康评分 |
| 21 | **对话知识抽取** | ✅ | MemoryExtractor: 每次对话异步提取 ≤5 条事实 |
| 22 | **测试覆盖** | ✅ | 309 tests (301 unit + 8 integration)，覆盖所有新模块 |

## Phase 2 待做

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| 23 | **定时调度器** | ⬜ | Scheduler Agent 支持 REALM.md/SOUL.md 的 proactiveRules |
| 24 | **向量语义搜索** | ⬜ | Retrieved Memory 层向量嵌入 + 语义检索 |
| 25 | **Web Dashboard** | ⬜ | Realm Matrix 面板 + 实体管理 + 健康可视化 |
| 26 | **Channel 集成** | ⬜ | Telegram/Discord/Slack 适配器完整实现 |
| 27 | **知识图谱** | ⬜ | 填充 knowledge_nodes/edges 表，支持关系查询 |
| 28 | **实体属性自动更新** | ⬜ | 从对话提取属性变更，自动更新 Entity |

## Phase 3 待做

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| 29 | **RealmHub 市场** | ⬜ | Realm 包发布/安装/版本管理 |
| 30 | **召唤体间交互** | ⬜ | 多 Summoned Agent 协作对话 |
| 31 | **跨域上下文窗口** | ⬜ | 域内对话自动加载相关跨域信息 |
| 32 | **预算治理** | ⬜ | Token 用量追踪，按域预算限制 |

## 社区与运营

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| 33 | **创建 Discord Server** | ⬜ | 按 discord-setup.md 指南搭建 The Reef |
| 34 | **发布首条 X 推文** | ⬜ | #BuildInPublic 风格 |
| 35 | **小红书首篇笔记** | ⬜ | Summon 概念介绍（宠物召唤方向） |
| 36 | **Product Hunt 预热** | ⬜ | Coming Soon 页面 |
| 37 | **CONTRIBUTING.md** | ⬜ | 贡献者指南 |

## 品牌补充

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| 38 | **OG 预览图** | ⬜ | 制作 1200x630 Open Graph 图 |
| 39 | **Favicon** | ⬜ | 从 avatar.png 生成 favicon.ico |
| 40 | **品牌素材包** | ⬜ | SVG 版本 logo/icon |
| 41 | **CI/CD** | ⬜ | GitHub Actions: lint → test → build |

## 优先级路径

```
Phase 1 ✅ 完成
  │
  ▼
Phase 2 (当前):
  定时调度器 (23) → 向量搜索 (24) → Dashboard (25) → Channel (26)
  │
  ▼
Phase 3:
  RealmHub (29) → 召唤体间交互 (30) → 跨域上下文 (31)
```
