# OpenOctopus 设计讨论与深化

> 基于项目发起人核心设想的讨论与优化

## 0. 核心设想摘要

OpenOctopus 与 OpenClaw 的根本差异：

| | OpenClaw | OpenOctopus |
|---|---|---|
| 组织方式 | 一个超级代理，按任务/技能划分 | 按人生域划分，每域独立运转 |
| 问题 | 所有事情堆在一起，杂乱 | 知识分类管理，清晰整洁 |
| 核心价值 | 自动化执行 | **人生知识库** + 实体化代理 |

四个核心设计点：

1. **域划分**：人生按域分类，知识分域管理
2. **域内对话**：先选域再对话，沉淀知识到域，同时参考跨域信息
3. **技能分层**：全局 Skill + 域 Skill，Agent 归属于域
4. **实体化**：将生活对象（宠物、家人、资产）变成可交互、可主动行动的 Agent

---

## 1. 域的命名："Area" vs 替代方案

### 1.1 候选分析

| 名称 | 中文 | 品牌感 | 章鱼关联 | 技术清晰度 | 生态命名 |
|---|---|---|---|---|---|
| **Area** | 域 | 中 | 弱 | 高 | AreaHub, area package |
| **Realm** | 域/界 | 强 | 中 | 高 | RealmHub, realm package |
| **Arm** | 臂 | 极强 | 极强 | 中（ARM 歧义） | ArmHub, arm package |
| **Domain** | 域 | 中 | 弱 | 低（DDD 冲突） | DomainHub |
| **Sphere** | 球/界 | 中 | 弱 | 中 | SphereHub |

### 1.2 推荐：Realm

**理由：**

章鱼生物学中，每条触手拥有独立的神经中枢（约 2/3 的神经元分布在触手中），能自主完成抓取、探索、品尝等动作，无需等待中央大脑指令。这与 **Realm（自治领地）** 的语义完美对应：

- 每个 Realm 有独立的实体、Agent、技能、知识库，能自主运转
- 中央大脑（OpenOctopus Core）协调跨 Realm 信息流通
- Realm 之间通过知识图谱互联，而非强耦合

**品牌一致性：**

- 中文：继续用"域"，自然流畅
- 英文：Realm 比 Area 更有质感和记忆点
- 生态命名：**RealmHub**（域能力市场）、**realm package**（域包）

### 1.3 默认域列表建议

用户提出的域分类梳理为以下默认 Realm：

| Realm | 中文 | 典型实体 | 典型 Agent |
|---|---|---|---|
| `home` | 家 | 房屋、家电、装修记录 | 家居管理助手、维修提醒 |
| `vehicle` | 车 | 车辆、保险、维保记录 | 保养提醒、费用追踪 |
| `pet` | 宠物 | 宠物、兽医、食品 | 健康顾问、喂养提醒 |
| `parents` | 父母 | 父母、健康档案 | 健康监护、礼物建议、关怀提醒 |
| `partner` | 爱人 | 伴侣、纪念日、共同目标 | 关系维护助手、纪念日提醒 |
| `friends` | 朋友 | 朋友圈、社交事件 | 社交雷达、聚会组织 |
| `finance` | 金钱 | 账户、投资、负债、预算 | 财务顾问、预算追踪 |
| `work` | 工作 | 项目、同事、目标 | 任务管理、周报生成 |
| `legal` | 法律 | 合同、案件、法条 | 法律顾问团队 |
| `hobby` | 兴趣 | 爱好项目、学习资料 | 学习教练、资源推荐 |
| `fitness` | 运动 | 训练计划、身体数据 | 健身教练、数据分析 |
| `health` | 健康 | 体检报告、病历、用药 | 健康监护、就医提醒 |

用户可自由创建、合并、删除 Realm。系统不强制分类——上述仅为新手引导时的推荐模板。

---

## 2. 对话与知识流转模型

### 2.1 三层对话空间

```
┌─────────────────────────────────────────────┐
│              Central（中枢大厅）               │
│  · 自动路由：识别意图，分发到对应 Realm        │
│  · 跨域查询：需要多域信息时在此汇总            │
│  · 全局管理：Realm 创建、设置、全局 Skill 调用  │
└──────────┬──────────────────────┬────────────┘
           │                      │
    ┌──────▼──────┐        ┌──────▼──────┐
    │  Pet Realm  │        │ Finance Realm│
    │  域内对话    │        │  域内对话     │
    │  域内知识    │        │  域内知识     │
    │  域内 Agent  │        │  域内 Agent   │
    └─────────────┘        └──────────────┘
```

**交互流程：**

1. **自动路由（默认）**：用户直接说话，系统识别意图后路由到对应 Realm
   - "我的狗最近总是挠耳朵" → 自动进入 Pet Realm
   - "下个月房贷多少" → 自动进入 Finance Realm
2. **显式进入**：用户主动选择 Realm 进行深度工作
   - 适合录入资料、整理知识、与域内 Agent 深度对话
3. **跨域汇总**：当一个问题涉及多域时，Central 负责调度
   - "我下个月开销预估" → Central 向 Finance、Vehicle、Pet、Home 各域收集信息

### 2.2 知识沉淀机制

每次域内对话结束后，系统自动执行：

```
对话 → 抽取关键信息 → 更新实体属性 → 补充域知识库 → 更新跨域图谱
```

| 阶段 | 说明 | 示例 |
|---|---|---|
| 信息抽取 | 从对话中识别事实、日期、数字、关系 | "Momo 上周打了疫苗" → 疫苗记录 |
| 实体更新 | 写入对应实体的属性 | Momo.vaccination_date = 2026-03-02 |
| 知识归档 | 生成结构化笔记存入域知识库 | Pet Realm / notes / 2026-03-09.md |
| 图谱更新 | 更新实体间关系 | Momo --vaccinated_by--> 张医生 |

### 2.3 跨域引用：上下文窗口

域内对话时，系统会自动加载**相关跨域上下文**（只读引用，不修改其他域）：

```
当前 Realm: Pet
对话内容: "Momo 生病了，要去看医生"

系统自动引入:
  - Finance Realm → 宠物医疗预算余额、宠物保险信息
  - Partner Realm → 伴侣是否有空陪同
  - Vehicle Realm → 最近的宠物医院导航
```

这就是"章鱼大脑"的核心能力——每条触手独立运作，但大脑协调信息在触手之间流通。

---

## 3. 技能与代理的分层架构

### 3.1 Skill 分层

```
┌──────────────────────────────────────┐
│           Global Skills              │
│  搜索、日历、邮件、翻译、文件管理      │
│  通用问答、提醒、通知、数据导入导出    │
└──────────────┬───────────────────────┘
               │ 所有 Realm 可调用
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐
│Pet     │ │Finance │ │Legal   │
│Skills  │ │Skills  │ │Skills  │
│·兽医查询│ │·税务计算│ │·法条检索│
│·食品数据│ │·投资分析│ │·合同审查│
│·疫苗追踪│ │·预算规划│ │·案例研究│
└────────┘ └────────┘ └────────┘
```

**Skill 声明规范：**

```typescript
interface Skill {
  id: string;
  name: string;
  scope: 'global' | 'realm';
  realms?: string[];       // scope=realm 时，绑定到哪些 realm
  description: string;
  triggers?: string[];     // 自动触发关键词
  permissions: Permission[];
}
```

### 3.2 Agent 分层

```
┌──────────────────────────────────┐
│        Central Agents            │
│  · Router Agent（意图路由）       │
│  · Cross-Realm Agent（跨域分析）  │
│  · Scheduler Agent（全局调度）    │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│     Realm Agents（域内代理）      │
│                                  │
│  Legal Realm:                    │
│    · 法律顾问 A（擅长合同）       │
│    · 法律顾问 B（擅长劳动法）     │
│    · 法律分析师（案例研究）       │
│                                  │
│  Pet Realm:                      │
│    · 宠物健康顾问                │
│    · 喂养管理师                  │
│    · Momo（实体化 Agent）        │  ← 实体化！
│                                  │
│  Finance Realm:                  │
│    · 预算顾问                    │
│    · 投资分析师                  │
│    · 税务助手                    │
└──────────────────────────────────┘
```

**关键区分：**

| 类型 | 归属 | 特点 |
|---|---|---|
| Central Agent | 全局 | 负责路由、跨域协调、全局调度 |
| Realm Agent | 域内 | 专业能力型，如法律顾问、财务分析师 |
| Entity Agent | 域内 | 由实体激活，拥有实体的记忆和性格（实体化） |

---

## 4. 实体化（Reification）：核心差异化功能

### 4.1 什么是实体化

将现实世界的对象（人、宠物、资产、组织……）转化为具有**记忆、性格、主动性**的 AI Agent。

```
原始数据 → 结构化实体 → 激活为 Agent → 可交互、可主动行动
```

这不是简单的数据录入，而是让你生活中的每个重要对象都拥有"数字生命"。

### 4.2 实体类型

| 类型 | 示例 | 激活后能力 |
|---|---|---|
| **生命实体** | 宠物、家人、朋友 | 模拟对话、性格模拟、需求表达、情感反应 |
| **资产实体** | 车、房、投资组合 | 状态监控、维护提醒、成本报告 |
| **组织实体** | 公司、学校、医院 | 流程指导、联系人管理、日程对接 |
| **抽象实体** | 目标、项目、习惯 | 进度追踪、偏差预警、复盘建议 |

### 4.3 实体 Schema

```typescript
interface Entity {
  id: string;
  name: string;
  realm: string;
  type: 'living' | 'asset' | 'organization' | 'abstract';
  avatar?: string;

  // 结构化档案
  profile: {
    basicInfo: Record<string, any>;   // 基础信息
    preferences: Record<string, any>; // 偏好
    history: TimelineEvent[];         // 时间线事件
    tags: string[];
  };

  // 知识库
  memories: Memory[];          // 与该实体相关的所有记忆
  documents: Document[];       // 关联文档

  // 关系网络
  relations: {
    targetEntityId: string;
    type: string;              // "owned_by", "parent_of", "friend_of"...
    metadata?: Record<string, any>;
  }[];

  // Agent 配置（实体化后）
  agent?: {
    enabled: boolean;
    personality: {
      tone: string;            // "温柔关心" | "理性直接" | "活泼好动"
      speakingStyle: string;   // 说话风格描述
      traits: string[];        // 性格标签
    };
    proactive: {
      enabled: boolean;
      triggers: Trigger[];     // 主动行动触发条件
      schedule?: CronExpr[];   // 定期检查
    };
    skills: string[];          // 该实体可调用的技能
  };
}
```

### 4.4 实体化示例

#### 示例 A：宠物 Momo（金毛犬）

**实体档案：**
```yaml
name: Momo
realm: pet
type: living
profile:
  basicInfo:
    breed: 金毛寻回犬
    age: 3岁
    weight: 30kg
    color: 金色
  preferences:
    food: [鸡肉, 牛肉, 不吃猪肉]
    activity: [游泳, 捡球, 散步]
    fear: [打雷, 吸尘器]
  history:
    - date: 2023-03-15
      event: 领养回家
    - date: 2026-03-02
      event: 年度疫苗接种（张医生）
```

**激活为 Agent 后：**

- 用户："Momo，今天想吃什么？"
- Momo Agent："汪！我最近好像有点胖了（30kg），要不今天吃鸡胸肉拌狗粮？上次牛肉罐头也不错，但张医生说要控制体重……"

- **主动行为**：
  - "距离 Momo 上次体检已经 6 个月了，建议预约张医生。"
  - "今天气温 35°C，提醒给 Momo 多准备饮水，避免中午遛狗。"
  - "Momo 的驱虫药该买了，上次用的是 xx 品牌。"

#### 示例 B：妈妈

**实体档案：**
```yaml
name: 妈妈
realm: parents
type: living
profile:
  basicInfo:
    age: 58
    location: 杭州
  preferences:
    hobbies: [国画, 太极, 种花]
    food: [清淡, 不吃辣]
    communication: 喜欢语音消息，不太会用复杂App
  health:
    conditions: [轻度高血压, 膝盖偶尔疼痛]
    medications: [降压药每日一次]
```

**激活为 Agent 后：**

- 用户："妈妈生日快到了，送什么好？"
- 妈妈 Agent："妈妈最近在学国画，而且膝盖不太好。可以考虑一套好的国画颜料，或者一个护膝热敷仪。她上次提到邻居李阿姨有个很好用的……"

- **模拟反应**：
  - 用户："如果我跟妈妈说想辞职创业，她会怎么反应？"
  - 妈妈 Agent 基于性格和已知信息模拟回应

- **主动行为**：
  - "妈妈的降压药按周期该续购了。"
  - "今天杭州降温到 5°C，提醒给妈妈打个电话关心一下。"
  - "距离妈妈上次体检已经 8 个月，建议安排年度体检。"

#### 示例 C：我的车（Tesla Model 3）

**激活为 Agent 后：**

- **主动行为**：
  - "根据行驶里程，轮胎该换位了。"
  - "本月充电费用 ¥340，比上月增加 20%，主要是长途出行导致。"
  - "保险下月到期，去年投保费用 ¥5,800，建议提前比价。"

### 4.5 实体间交互

实体化的最大想象力：**实体之间可以对话和协作。**

```
场景：用户说"我下周要出差 5 天"

中央大脑触发跨域协调：

  Momo Agent（Pet）: "我需要有人喂我和遛我 5 天！"
  妈妈 Agent（Parents）: "可以让妈妈来照顾 Momo，她最近正好说想来你这儿住几天。"
  车 Agent（Vehicle）: "需要提前充满电吗？还是打车去机场？"
  财务 Agent（Finance）: "出差预算建议 ¥X，记得保存发票报销。"

  → 系统汇总为一份"出差准备清单"，用户确认后自动执行各项行动。
```

这就是"八爪协同"——每个域的实体 Agent 从自己的角度思考，中央大脑汇总成可执行方案。

---

## 5. 整体架构图

```
┌───────────────────────────────────────────────────────────────┐
│                    OpenOctopus Core（章鱼大脑）                 │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │ Router      │  │ Cross-Realm │  │ Knowledge Graph      │  │
│  │ Agent       │  │ Coordinator │  │ (跨域实体关系图谱)     │  │
│  └─────────────┘  └─────────────┘  └──────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   Global Skills                         │  │
│  │  搜索 · 日历 · 邮件 · 翻译 · 文件 · 通知 · 数据导入     │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────┬───────────────┬───────────────┬───────────────┬───────┘
        │               │               │               │
   ┌────▼────┐    ┌─────▼────┐    ┌─────▼────┐   ┌─────▼────┐
   │  Pet    │    │ Finance  │    │  Legal   │   │ Parents  │
   │  Realm  │    │  Realm   │    │  Realm   │   │  Realm   │
   │         │    │          │    │          │   │          │
   │ Agents: │    │ Agents:  │    │ Agents:  │   │ Agents:  │
   │ ·健康顾问│    │ ·预算顾问 │    │ ·合同律师 │   │ ·关怀助手 │
   │ ·Momo☆  │    │ ·投资分析 │    │ ·劳动法顾问│   │ ·妈妈☆   │
   │         │    │          │    │ ·案例研究  │   │ ·爸爸☆   │
   │ Skills: │    │ Skills:  │    │          │   │          │
   │ ·兽医查询│    │ ·税务计算 │    │ Skills:  │   │ Skills:  │
   │ ·食品数据│    │ ·预算规划 │    │ ·法条检索 │   │ ·健康追踪 │
   │         │    │          │    │ ·合同审查 │   │ ·礼物推荐 │
   │ Memory: │    │ Memory:  │    │          │   │          │
   │ ·疫苗记录│    │ ·账单历史 │    │ Memory:  │   │ Memory:  │
   │ ·体检报告│    │ ·投资组合 │    │ ·合同档案 │   │ ·健康档案 │
   └─────────┘    └──────────┘    └──────────┘   └──────────┘

   ☆ = 实体化 Agent（Entity Agent）
```

---

## 6. 与 OpenClaw 的完整差异对照

| 维度 | OpenClaw | OpenOctopus |
|---|---|---|
| 组织哲学 | 一个超级代理，万物皆任务 | 人生按域划分，每域自治 |
| 核心抽象 | Task → Agent → Skill | **Realm → Entity → Agent → Skill** |
| 知识管理 | 统一上下文，容易混杂 | 分域沉淀，跨域图谱关联 |
| Agent 归属 | 全局池 | 域内专属 + 全局协调 |
| Skill 分层 | 统一注册 | **Global Skill + Realm Skill** 双层 |
| 差异化功能 | 自动化执行 | **实体化（Reification）** |
| 实体模型 | 无 | 生命/资产/组织/抽象四类实体 |
| 交互模式 | 单窗对话 | 域路由 + 跨域协调 + 实体间对话 |
| 分享市场 | ClawHub（技能粒度） | **RealmHub（域包粒度）** |
| 比喻 | 一把瑞士军刀 | 一只章鱼，八臂并行 |

---

## 7. 信息架构更新

基于以上讨论，更新后的数据模型：

```
OpenOctopus
├── Core
│   ├── Router Agent
│   ├── Cross-Realm Coordinator
│   ├── Knowledge Graph（跨域实体关系）
│   └── Global Skills
│
├── Realm（域）
│   ├── metadata（名称、图标、描述）
│   ├── Entities（实体）
│   │   ├── profile（档案）
│   │   ├── memories（记忆）
│   │   ├── documents（文档）
│   │   ├── relations（关系 → 跨域）
│   │   └── agent config（实体化配置）
│   ├── Agents（域内代理）
│   │   ├── Realm Agents（专业型）
│   │   └── Entity Agents（实体化型）
│   ├── Skills（域技能）
│   ├── Memory（域知识库）
│   └── Actions / Insights
│
└── RealmHub
    └── Realm Package（可分享的域包）
        ├── realm template
        ├── entity templates
        ├── agent configs
        ├── skill configs
        └── sample data
```

---

## 8. 产品一句话重新定位

**旧版：** Area-native life agent system.

**新版建议：**

> **OpenOctopus — your life, reified.**
>
> 把人生分域治理，把万物实体化为 Agent，八臂并行，一脑协同。

"Reified"（实体化）既是技术特征，也是品牌关键词——这是 OpenOctopus 独有的，OpenClaw 没有的。
