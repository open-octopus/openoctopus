# OpenOctopus 功能优化思路与路线图

> 更新时间：2026-03-11 | 版本：v1.0
> 本文档整理所有核心功能的优化思路、实现状态和后续方向。

---

## 目录

1. [架构全景](#1-架构全景)
2. [Living 巡检与激活](#2-living-巡检与激活)
3. [冷启动 — 对话式知识补充](#3-冷启动--对话式知识补充)
4. [初始化 — 扫描目录注入知识](#4-初始化--扫描目录注入知识)
5. [异步激活非主 Realm 反应](#5-异步激活非主-realm-反应)
6. [记忆健康与自动维护](#6-记忆健康与自动维护)
7. [知识沉淀自动化](#7-知识沉淀自动化)
8. [实现状态总览](#8-实现状态总览)
9. [后续优化方向](#9-后续优化方向)

---

## 1. 架构全景

### 1.1 系统分层架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                         用户接入层                                    │
│   tentacle CLI (WS RPC)  │  Web Dashboard (Phase 2)  │  Channels    │
└──────────┬───────────────┴────────────────────────────┴──────────────┘
           │
┌──────────▼──────────────────────────────────────────────────────────┐
│                     ink 网关层 (双端口)                               │
│   Port 19789: WebSocket JSON-RPC (主通道，流式传输)                    │
│   Port 19790: HTTP REST Bridge (兼容通道)                            │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │              Chat Pipeline (消息处理管线)                 │       │
│   │  1. 会话管理 (JSONL)                                     │       │
│   │  2. 意图路由 → Realm                                     │       │
│   │  3. 加载域记忆 → System Prompt                           │       │
│   │  4. AgentRunner 执行 (流式)                              │       │
│   │  5. 异步后处理 (fire-and-forget):                        │       │
│   │     ├─ MemoryExtractor: 抽取知识 → 持久化                │       │
│   │     ├─ MaturityScanner: 检查实体成熟度 → 激活建议         │       │
│   │     └─ CrossRealmReactor: 跨域 Agent 反应                │       │
│   └─────────────────────────────────────────────────────────┘       │
└──────────┬──────────────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────────────┐
│                        core 核心层                                    │
│                                                                      │
│   ┌──────────┐  ┌──────────────┐  ┌───────────────┐                │
│   │  Router   │  │ RealmManager │  │ EntityManager │                │
│   │ (意图路由) │  │ (域生命周期)  │  │ (实体生命周期) │                │
│   └──────────┘  └──────────────┘  └───────────────┘                │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────┐      │
│   │              Knowledge Lifecycle (知识生命周期)            │      │
│   │  ┌─────────────────┐  ┌────────────────────────────┐    │      │
│   │  │ KnowledgeDistri-│  │ MemoryHealthManager        │    │      │
│   │  │ butor (知识分发)  │  │ (记忆健康: 去重/过期/矛盾)   │    │      │
│   │  └─────────────────┘  └────────────────────────────┘    │      │
│   │  ┌─────────────────┐  ┌────────────────────────────┐    │      │
│   │  │ MaturityScanner │  │ CrossRealmReactor          │    │      │
│   │  │ (成熟度巡检)     │  │ (跨域反应)                  │    │      │
│   │  └─────────────────┘  └────────────────────────────┘    │      │
│   │  ┌─────────────────┐  ┌────────────────────────────┐    │      │
│   │  │ DirectoryScanner│  │ MemoryExtractor            │    │      │
│   │  │ (目录扫描初始化)  │  │ (对话知识抽取)              │    │      │
│   │  └─────────────────┘  └────────────────────────────┘    │      │
│   └──────────────────────────────────────────────────────────┘      │
│                                                                      │
│   ┌──────────┐  ┌───────────────────┐                               │
│   │ AgentRun-│  │ LLM Provider      │                               │
│   │ ner      │  │ Registry          │                               │
│   │ (执行引擎)│  │ (多供应商+故障转移) │                               │
│   └──────────┘  └───────────────────┘                               │
└──────────┬──────────────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────────────┐
│                     summon 召唤层                                     │
│   SoulParser (SOUL.md 解析)                                          │
│   PromptCompiler (分层记忆 → System Prompt)                          │
│   SummonEngine (实体 → 有记忆有性格的 Agent)                          │
└──────────┬──────────────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────────────┐
│                     storage 存储层 (SQLite)                           │
│   RealmRepo │ EntityRepo │ MemoryRepo │ AgentRepo │ AuditRepo       │
│   HealthReportRepo │ ScannedFileRepo │ OnboardingRepo               │
│   SessionStore (JSONL)                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 数据流闭环

```
用户对话
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│                    知识沉淀闭环                                │
│                                                              │
│  对话 ──→ 信息抽取 ──→ 实体属性更新 ──→ 域知识库归档          │
│   │                                      │                   │
│   │         ┌────────────────────────────┘                   │
│   │         ▼                                                │
│   │    跨域图谱更新 ──→ 跨域上下文引用                        │
│   │                                                          │
│   ▼                                                          │
│  成熟度评估 ──→ 达到阈值? ──→ 建议召唤                        │
│   │                                                          │
│   ▼                                                          │
│  健康巡检 ──→ 去重/清理/压缩 ──→ 提升知识质量                 │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 记忆分层 (Letta 模式)

```
┌─────────────────────────────────────────────────────┐
│  Core Memory (核心记忆)                               │
│  · 始终在上下文中                                     │
│  · SOUL.md 中的 coreMemory + core 层级条目            │
│  · 固定身份信息，不会被清理                            │
├─────────────────────────────────────────────────────┤
│  Working Memory (工作记忆)                            │
│  · 当前会话的近期上下文                                │
│  · 随会话滚动更新                                     │
├─────────────────────────────────────────────────────┤
│  Retrieved Memory (检索记忆)                          │
│  · 按相关性检索的历史记忆                              │
│  · 未来: 向量嵌入语义搜索                              │
├─────────────────────────────────────────────────────┤
│  Archival Memory (归档记忆)                           │
│  · 长期存储，按需查询                                  │
│  · 对话抽取的事实默认存入此层                           │
│  · 健康管理: 去重、过期清理、压缩                       │
└─────────────────────────────────────────────────────┘
```

---

## 2. Living 巡检与激活

### 2.1 核心思路

当系统持续积累实体（宠物、家人、资产等）的知识后，**自动检测**哪些实体已经"足够了解"，可以被**召唤为有性格、有记忆的 Living Agent**。这不是手动触发，而是系统通过持续巡检、数据驱动地建议激活。

### 2.2 成熟度评分公式

```
overall = round(attributeCompleteness × 0.3 + memoryDepth × 0.4 + interactionFrequency × 0.3)
```

| 维度 | 权重 | 计算方式 | 说明 |
|------|------|----------|------|
| **属性完整度** | 30% | `非空属性数 / 总属性数 × 100` | 名字、品种、年龄等基础信息 |
| **记忆深度** | 40% | `min(archival记忆数 / 10, 1) × 100` | 至少 10 条归档记忆 = 满分 |
| **交互频率** | 30% | `min(总记忆数 / 15, 1) × 100` | 至少 15 次交互 = 满分 |

**激活阈值**: `overall ≥ 60` 且状态为 `dormant` → `readyToSummon = true`

### 2.3 巡检机制

```
每次域内对话后 (fire-and-forget):
  │
  ├─ MaturityScanner.checkAndNotify(realmId)
  │   ├─ 扫描该域所有实体
  │   ├─ 计算每个实体的成熟度分数
  │   └─ 分数 ≥ 60 且 dormant → 广播 maturity.suggestion 事件
  │
  └─ CLI / Dashboard 收到事件 → 提示用户
       "Luna 的知识已足够丰富（分数: 72），是否要将她召唤为 Living Agent？"
```

### 2.4 实体状态流转

```
dormant (休眠)
  │
  │ 用户确认召唤
  ▼
summoning (召唤中)
  │
  │ 解析 SOUL.md + 编译 System Prompt + 创建 Agent
  ▼
active (活跃)
  │
  │ 用户释放 / 手动暂停
  ▼
suspended (暂停)
```

### 2.5 实现状态

| 组件 | 状态 | 文件 |
|------|------|------|
| MaturityScanner | ✅ 已实现 | `packages/core/src/maturity-scanner.ts` |
| SummonEngine | ✅ 已实现 | `packages/summon/src/summon-engine.ts` |
| 巡检事件广播 | ✅ 已实现 | `chat-pipeline.ts` → `maturity.suggestion` 事件 |
| CLI 提示渲染 | ✅ 已实现 | `tentacle/src/tui/renderer.ts` |
| 测试覆盖 | ✅ 14 tests | `maturity-scanner.test.ts` |

### 2.6 后续优化

- [ ] **定时巡检**: 不仅对话后检查，还应有定时任务（如每天一次全局扫描），避免不活跃域的实体被遗忘
- [ ] **渐进式引导**: 分数接近阈值时（如 45-59），主动提示用户"再补充几条信息就可以召唤 Luna 了"
- [ ] **自动召唤**: 达到高阈值（如 90）时可选自动召唤，无需用户确认
- [ ] **召唤后持续评估**: Active 状态的实体也应持续评估，知识过时则建议"刷新"

---

## 3. 冷启动 — 对话式知识补充

### 3.1 核心思路

新用户初次使用时，系统通过**多轮对话引导**，让用户自然地讲述生活信息。系统自动提取事实、分类到 Realm、创建实体，完成知识库的冷启动。不是填表单，而是聊天。

### 3.2 对话流程

```
系统: "告诉我你的生活吧！比如你有什么宠物、家人、爱好？"
       │
       ▼
用户: "我养了一只猫叫 Luna，她是橘猫，3 岁了"
       │
       ▼
KnowledgeDistributor.distributeFromText()
  ├─ LLM 提取 (有 API Key 时):
  │   → [{realm: "pet", entityName: "Luna", entityType: "living", fact: "Luna 是橘猫，3 岁"}]
  │
  └─ 关键词回退 (无 API Key 时):
      → 匹配 "猫" → pet realm → 按句子拆分为多条 fact
       │
       ▼
系统: "Got it! I captured 2 facts across pet. Tell me more, or type /done to finish."
       │
       ▼
用户: "我在一家科技公司上班，月薪 15000"
       │
       ▼
系统: "Added 2 more facts (work, finance). Anything else?"
       │
       ▼
用户: /done
       │
       ▼
OnboardingRepo.markCompleted(["pet", "work", "finance"])
```

### 3.3 智能分类

知识分发器内置 **12 个域的中英文关键词表**（共 200+ 关键词），支持：

- **LLM 路径** (有 API Key): 结构化 JSON 输出，含 realm/entityName/entityType/fact
- **关键词回退** (无 API Key): 按关键词匹配度评分，选最佳 Realm
- **自动实体创建**: 提取到 entityName + entityType 时自动创建实体记录
- **句子拆分**: 长文本按句号/感叹号/换行拆分为独立 fact

### 3.4 实现状态

| 组件 | 状态 | 文件 |
|------|------|------|
| KnowledgeDistributor | ✅ 已实现 | `packages/core/src/knowledge-distributor.ts` |
| processOnboardingInput | ✅ 已实现 | 同上（多步对话引导） |
| OnboardingRepo | ✅ 已实现 | `packages/storage/src/repos/onboarding-repo.ts` |
| 自动实体创建 | ✅ 已实现 | createMissingEntity() |
| LLM + 关键词双路径 | ✅ 已实现 | extractWithLlm() / extractWithKeywords() |
| RPC: knowledge.inject | ✅ 已实现 | `rpc-handlers.ts` |
| 测试覆盖 | ✅ 19 tests | `knowledge-distributor.test.ts` |

### 3.5 后续优化

- [ ] **智能追问**: 根据已收集的信息，主动追问空白域（如"你有宠物吗？""平时有什么爱好？"）
- [ ] **模板引导**: 提供域特定的问题模板（如 Pet: 品种/年龄/食物偏好/兽医信息）
- [ ] **导入已有数据**: 支持从 Notion/备忘录/微信聊天记录批量导入
- [ ] **进度可视化**: 展示各 Realm 的知识填充进度，激励用户补全

---

## 4. 初始化 — 扫描目录注入知识

### 4.1 核心思路

用户可能已有大量本地文件（笔记、文档、JSON 配置），系统可以**扫描指定目录**，自动提取知识注入到各 Realm。支持增量扫描——文件未变更则跳过。

### 4.2 扫描流程

```
tentacle CLI / RPC: directory.scan { path: "/Users/me/notes" }
  │
  ▼
DirectoryScanner.scanDirectory(path, options)
  │
  ├─ 递归遍历目录
  │   ├─ 跳过: 隐藏文件(.*)、node_modules、空文件、超大文件(>1MB)
  │   └─ 匹配: .md, .txt, .json (可配置 extensions)
  │
  ├─ 增量检查 (ScannedFileRepo)
  │   ├─ 计算文件 SHA256 哈希
  │   ├─ 与已记录的哈希对比
  │   └─ 相同 → 跳过; 不同 → 重新扫描
  │
  ├─ 读取文件内容
  │   └─ KnowledgeDistributor.distributeFromText(content)
  │       → 提取 facts → 分类到 Realm → 创建记忆
  │
  └─ 记录扫描结果
      └─ ScannedFileRepo.upsert({ path, hash, factsExtracted })
```

### 4.3 配置项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `extensions` | `[".md", ".txt", ".json"]` | 扫描的文件类型 |
| `maxFileSize` | `1048576` (1MB) | 最大文件大小 |
| `dryRun` | `false` | 仅模拟，不实际注入 |

### 4.4 实现状态

| 组件 | 状态 | 文件 |
|------|------|------|
| DirectoryScanner | ✅ 已实现 | `packages/core/src/directory-scanner.ts` |
| ScannedFileRepo | ✅ 已实现 | `packages/storage/src/repos/scanned-file-repo.ts` |
| SHA256 增量检查 | ✅ 已实现 | 文件哈希追踪 |
| RPC: directory.scan | ✅ 已实现 | `rpc-handlers.ts` |
| 测试覆盖 | ✅ 16 tests | `directory-scanner.test.ts` |

### 4.5 后续优化

- [ ] **文件监听 (watch 模式)**: 使用 `fs.watch` 监听目录变化，实时触发增量扫描
- [ ] **更多文件格式**: 支持 .csv, .yaml, .pdf（通过 OCR/解析器扩展）
- [ ] **LLM 增强提取**: 有 API Key 时用 LLM 对整个文件做深度语义理解，而非逐句关键词匹配
- [ ] **扫描报告**: 生成可视化的扫描报告（扫了多少文件、注入了多少知识、影响了哪些域）
- [ ] **REALM.md 自动加载**: 启动时自动从 `realms/` 目录加载所有 REALM.md（已通过 RealmLoader 实现）

---

## 5. 异步激活非主 Realm 反应

### 5.1 核心思路

当用户在某个 Realm 对话时，**其他域的已激活 Summoned Agent 可以异步"旁听"并做出反应**。例如在 Pet 域聊"猫咪看病花了很多钱"，Finance 域的 Agent 可能提醒"注意宠物医疗预算"。

这体现了章鱼大脑的核心能力：每条触手独立运作，但大脑协调信息在触手之间流通。

### 5.2 反应流程

```
用户在 Pet Realm 对话: "猫咪看病花了很多钱"
  │
  ▼
Chat Pipeline 返回主响应 (不阻塞)
  │
  └─ 异步 (fire-and-forget):
     CrossRealmReactor.checkReactions()
       │
       ├─ 获取所有活跃的 Summoned Agent
       │   └─ 过滤掉同域的 Agent (Pet 域的不参与)
       │
       ├─ 关键词评分 (12 域 × 200+ 关键词)
       │   └─ "钱" + "花费" → finance 得分最高
       │
       ├─ 选择得分最高的 Agent
       │   └─ Finance Agent (score: 3)
       │
       └─ LLM 生成一句话反应 (≤50 字, temperature=0.3)
           │
           ├─ 内容有价值 → 广播 crossrealm.reaction 事件
           │   └─ CLI 显示: "[Finance Agent] 注意宠物医疗支出，建议查看月度预算"
           │
           └─ 返回 "SKIP" 或 <5 字 → 不打扰用户
```

### 5.3 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 触发时机 | 每次对话后异步 | 不阻塞主响应，用户体验优先 |
| 反应数量 | 最多 1 条/轮 | 避免信息过载 |
| 反应长度 | ≤ 50 字 | 简短提醒而非长篇大论 |
| 无 LLM 时 | 不反应 | 关键词仅做筛选，不生成内容 |
| SKIP 机制 | LLM 判断不相关时返回 "SKIP" | 避免强行关联 |

### 5.4 实现状态

| 组件 | 状态 | 文件 |
|------|------|------|
| CrossRealmReactor | ✅ 已实现 | `packages/core/src/cross-realm-reactor.ts` |
| 关键词评分 (12 域) | ✅ 已实现 | REALM_KEYWORDS 映射表 |
| LLM 反应生成 | ✅ 已实现 | generateReaction() |
| Pipeline 集成 | ✅ 已实现 | `chat-pipeline.ts` fire-and-forget |
| 事件广播 | ✅ 已实现 | `crossrealm.reaction` WebSocket 事件 |
| CLI 渲染 | ✅ 已实现 | `tentacle/src/tui/renderer.ts` |
| 测试覆盖 | ✅ 11 tests | `cross-realm-reactor.test.ts` |

### 5.5 后续优化

- [ ] **多 Agent 反应**: 当前只取最高分 1 个，可扩展为 top-N（如 2-3 个）同时反应
- [ ] **反应记忆**: 将有价值的跨域反应存入目标 Realm 的记忆，形成知识跨域沉淀
- [ ] **用户反馈闭环**: 用户可以对反应点赞/忽略，系统学习调整触发灵敏度
- [ ] **上下文增强**: 反应时注入目标域的知识，使反应更精准（如知道用户的预算余额）
- [ ] **召唤体间交互**: 多个 Summoned Agent 之间的对话协作（见 [design-decisions.md](design-decisions.md) §4.5）

---

## 6. 记忆健康与自动维护

### 6.1 核心思路

知识库随时间膨胀后，会出现**重复、过时、矛盾、不完整**等问题。MemoryHealthManager 定期检查域的记忆健康度，并提供自动清理能力。

### 6.2 健康评分公式

```
healthScore = max(0, min(100,
  100
  - duplicateRate × 20 × 100     // 重复记忆惩罚
  - staleRate × 15 × 100         // 过期记忆惩罚
  - contradictionCount × 10      // 矛盾记忆惩罚
  - incompleteRate × 10 × 100    // 不完整实体惩罚
))
```

### 6.3 检测的四类问题

| 问题类型 | 检测方式 | 阈值 |
|----------|----------|------|
| **重复记忆** | 归一化 Levenshtein 距离 < 0.3 | 相似度 70%+ 判定为重复 |
| **过期记忆** | updated_at > 90 天未更新 | 可配置 staleDays |
| **矛盾记忆** | LLM 分析事实冲突 | 每批最多 30 条 |
| **不完整实体** | 属性为 0 且记忆 < 3 条 | — |

### 6.4 清理操作

| 操作 | 说明 |
|------|------|
| `deduplicate` | 保留首条，删除相似重复项 |
| `archiveStale` | 过期记忆标记为 archival 层级 |
| `compress` | LLM 将多条相关记忆合并为摘要（无 LLM 时拼接） |
| `promoteToCore` | 重要记忆提升到 core 层级 |

### 6.5 实现状态

| 组件 | 状态 | 文件 |
|------|------|------|
| MemoryHealthManager | ✅ 已实现 | `packages/core/src/memory-health-manager.ts` |
| HealthReportRepo | ✅ 已实现 | `packages/storage/src/repos/health-report-repo.ts` |
| RPC: health.report | ✅ 已实现 | 单域 / 全域健康报告 |
| RPC: health.clean | ✅ 已实现 | 去重 + 归档清理 |
| 测试覆盖 | ✅ 29 tests | `memory-health-manager.test.ts` |

### 6.6 后续优化

- [ ] **定时健康巡检**: 每天自动运行 `computeAllHealth()`，发现问题主动通知
- [ ] **矛盾解决建议**: 检测到矛盾时，让用户选择保留哪条，或让 LLM 生成合并版本
- [ ] **健康趋势图**: Dashboard 展示健康分数随时间的变化趋势
- [ ] **智能压缩**: 按主题聚类后压缩，而非简单拼接

---

## 7. 知识沉淀自动化

### 7.1 核心思路

每次对话后，系统自动从用户和 AI 的对话中**抽取持久化知识**（偏好、决策、事件、关系、计划、日期），存入域记忆库。这是 OpenOctopus 作为"人生知识库"的核心能力。

### 7.2 抽取流程

```
对话完成后 (fire-and-forget):
  │
  ▼
MemoryExtractor.extractAndPersist()
  │
  ├─ LLM 分析 user + assistant 消息
  │   → 提取最多 5 条持久化事实
  │   → 聚焦: 偏好、决策、事件、关系、状态、计划、日期
  │
  ├─ 存入 archival 层级记忆
  │
  └─ 触发跨域分发 (可选)
      └─ KnowledgeDistributor.classifyAndDistribute()
          → 涉及其他域的事实自动分发过去
```

### 7.3 实现状态

| 组件 | 状态 | 文件 |
|------|------|------|
| MemoryExtractor | ✅ 已实现 | `packages/core/src/memory-extractor.ts` |
| Pipeline 集成 | ✅ 已实现 | `chat-pipeline.ts` fire-and-forget |
| 跨域分发 | ✅ 已实现 | classifyAndDistribute() |
| 测试覆盖 | ✅ 8 tests | `memory-extractor.test.ts` |

### 7.4 后续优化

- [ ] **实体属性自动更新**: 抽取到"Luna 现在 4 岁了"时，直接更新 Entity.attributes.age = 4
- [ ] **知识图谱构建**: 抽取实体间关系存入 knowledge_edges 表（schema 已有，逻辑未实现）
- [ ] **去重合并**: 新提取的事实与已有记忆对比，相似则合并而非重复存储
- [ ] **重要度评分**: 为每条提取的事实评估重要度，高重要度直接提升到 core 层级

---

## 8. 实现状态总览

### 8.1 Phase 1 完成情况

| 模块 | 子功能 | 状态 | 测试 |
|------|--------|------|------|
| **Router** | LLM 路由 + 关键词回退 | ✅ | 5 |
| **RealmManager** | CRUD + 健康分数 | ✅ | 9 |
| **EntityManager** | CRUD + 查询 | ✅ | 5 |
| **AgentRunner** | 流式执行 + 多供应商 | ✅ | — |
| **SummonEngine** | 召唤/释放/列表 | ✅ | 6 |
| **PromptCompiler** | 分层记忆编译 | ✅ | — |
| **SoulParser** | SOUL.md 解析 | ✅ | 6 |
| **RealmLoader** | REALM.md 加载 | ✅ | 7 |
| **MemoryExtractor** | 对话知识抽取 | ✅ | 8 |
| **KnowledgeDistributor** | 知识分发 + 冷启动 | ✅ | 19 |
| **MaturityScanner** | 成熟度巡检 | ✅ | 14 |
| **CrossRealmReactor** | 跨域反应 | ✅ | 11 |
| **DirectoryScanner** | 目录扫描 | ✅ | 16 |
| **MemoryHealthManager** | 记忆健康管理 | ✅ | 29 |
| **Chat Pipeline** | 完整消息处理管线 | ✅ | 14 |
| **RPC Handlers** | 35 个 JSON-RPC 方法 | ✅ | 24 |
| **Storage** | 8 个 Repo + 迁移 | ✅ | 44 |
| **Config** | JSON5 + Zod 验证 | ✅ | 12 |
| **集成测试** | 端到端知识生命周期 | ✅ | 8 |
| **总计** | | | **309** |

### 8.2 测试覆盖

```
单元测试:   301 passed (25 test files)
集成测试:     8 passed (1 test file)
总计:       309 tests ✅
```

---

## 9. 后续优化方向

### 9.1 短期 (Phase 2)

| 优化项 | 优先级 | 说明 |
|--------|--------|------|
| **定时调度器** | P0 | 实现 Scheduler Agent，支持 REALM.md 和 SOUL.md 中定义的 proactiveRules |
| **向量语义搜索** | P0 | 为 Retrieved Memory 层实现向量嵌入 + 语义检索 |
| **Web Dashboard** | P1 | Realm Matrix 可视化面板，展示所有域状态/健康/实体 |
| **实体属性自动更新** | P1 | 从对话中提取属性变更，自动更新 Entity 记录 |
| **知识图谱** | P1 | 填充 knowledge_nodes / knowledge_edges 表，支持关系查询 |
| **Channel 适配器** | P2 | Telegram/Discord/Slack 完整集成 |

### 9.2 中期 (Phase 3)

| 优化项 | 说明 |
|--------|------|
| **RealmHub 市场** | Realm 包的发布、安装、版本管理 |
| **召唤体间交互** | 多个 Summoned Agent 协作对话，中央大脑汇总 |
| **跨域上下文窗口** | 域内对话自动加载相关跨域信息（只读引用） |
| **预算治理** | Token 用量追踪、按域预算限制、成本告警 |
| **文件监听模式** | `fs.watch` 实时监听目录变化，自动增量扫描 |

### 9.3 长期愿景

| 方向 | 说明 |
|------|------|
| **一人公司经营驾驶舱** (P1) | 每周运营计划 + 每日执行追踪 + 周报复盘 |
| **生活编排 OS** (P2) | 多代理协商 (你/伴侣/预算/时间/偏好代理) |
| **多角色决策模拟** (P3) | argue-agent 产品化，多立场推演 |
| **自部署方案** | Ansible playbook + Tailscale + 自动备份 |
| **智能家居集成** (casa) | Home Assistant REST + WS 双通道集成 |

---

## 附录: 关键文件索引

| 类别 | 文件 | 说明 |
|------|------|------|
| **架构设计** | [design-decisions.md](design-decisions.md) | 完整架构、Summon 设计、跨域协调 |
| **产品定位** | [product/positioning.md](../product/positioning.md) | 一句话定位、信息架构、里程碑 |
| **竞品分析** | [research/05-competitive-landscape.md](../research/05-competitive-landscape.md) | 25+ 竞品分析 |
| **技术选型** | [research/06-agent-frameworks-ecosystem.md](../research/06-agent-frameworks-ecosystem.md) | Agent 框架生态 |
| **90 天路线图** | [research/03-优先级路线图与90天实验.md](../research/03-优先级路线图与90天实验.md) | P1-P3 优先方向 |
| **待办清单** | [operations/todo-checklist.md](../operations/todo-checklist.md) | 23 项发布任务 |
| **品牌规范** | [product/branding.md](../product/branding.md) | 颜色、Logo、语调 |
| **核心类型** | `packages/shared/src/types.ts` | Zod 验证的所有数据模型 |
| **RPC 协议** | `packages/shared/src/rpc-protocol.ts` | 35 个方法 + 8 个事件 |
| **数据库迁移** | `packages/storage/src/migrations.ts` | v1 + v2 表结构 |
