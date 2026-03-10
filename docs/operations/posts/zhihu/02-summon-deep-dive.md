# 知乎 #02 — Summon 深度解析

> 类型：知乎专栏文章（长文）
> 目标：技术深度 + 场景想象，吸引开发者和产品人群
> 建议投放话题：#AI Agent #数字孪生 #开源

---

## 标题

**「召唤」：让你的宠物、家人、爱车变成 AI Agent 是一种什么体验？**

## 正文

### 一个场景

周五晚上，你对 AI 说了一句：

> 「下周要出差 5 天。」

然后你的系统里发生了这些事：

🐕 **Momo**（你的金毛，被召唤为 Agent）：
> 「5 天？！谁来喂我！上次你出差让邻居喂的，我的零食都被偷吃了。」

👩 **妈妈**（家庭域，被召唤为 Agent）：
> 「我周一没课，可以过来照顾 Momo。顺便帮你浇花。」

🚗 **Model Y**（车辆域，被召唤为 Agent）：
> 「你要开车去机场还是打车？如果开车，建议明天充满电。当前续航 287km。」

💰 **预算顾问**（金融域，专业 Agent）：
> 「5 天出差预估费用 ¥4,200。本月预算还剩 ¥6,800，可覆盖。记得保存发票。」

系统自动汇总，生成了一份**出差准备清单**，等你确认。

你没有分别打开 5 个 App。你说了一句话，整个人生的各个域自动协作响应。

---

这就是 **Summon**（召唤）。

---

### Summon 是什么？

Summon 是 OpenOctopus 的核心功能：

> **把真实世界中的任何实体（Entity）转化为一个有记忆、有性格、有主动行为能力的 AI Agent。**

流程：

```
原始数据 → 结构化实体(Entity) → SUMMON → 有灵魂的 Agent
```

「灵魂」来自一个叫 `SOUL.md` 的配置文件，定义了被召唤者的性格、语气、行为触发条件。

---

### 四种实体类型

| 类型 | 示例 | 召唤后能做什么 |
|---|---|---|
| **生命体** | 宠物、父母、朋友 | 模拟对话（带性格）、情感表达、主动关怀提醒 |
| **资产** | 车、房子、投资组合 | 状态自报告、维护倒计时、费用分析 |
| **组织** | 公司、医院、学校 | 流程导航、文档检索、联系人推荐 |
| **抽象体** | 年度目标、创业项目、健身计划 | 进度追踪、偏差预警、阶段性回顾 |

关键区分：

- **专业 Agent**（如律师顾问、财务分析师）是系统预设的角色，基于知识库回答问题。
- **召唤 Agent** 是从你的真实数据中「生长」出来的，它有**你赋予的记忆和性格**。

---

### Summon 的三个关键属性

#### 1. 记忆（Memory）

召唤 Agent 不是无状态的。每次交互的关键信息都会沉淀为长期记忆。

Momo 记得：
- 上次生病是 3 个月前，拉肚子，吃了蒙脱石散
- 最喜欢的零食是冻干鸡胸肉
- 上次洗澡是 12 天前

这些记忆不靠你手动更新——系统从对话中自动提取、确认、存储。

#### 2. 性格（Personality）

`SOUL.md` 定义了 Agent 的性格特征：

```yaml
# SOUL.md — Momo
personality:
  tone: 撒娇、活泼、偶尔戏精
  speaking_style: 短句为主，喜欢用感叹号，偶尔无理取闹
  traits:
    - 对吃的东西特别敏感
    - 害怕打雷
    - 看到行李箱就焦虑
```

所以当你打开行李箱时，Momo 的反应是：
> 「你又要走了？！上次你走了 3 天我瘦了 1 斤你知道吗！」

不是通用 AI 的礼貌回答，而是**属于 Momo 的表达**。

#### 3. 主动性（Proactivity）

召唤 Agent 不只被动回答问题，它会基于触发条件主动行动：

```yaml
proactive:
  triggers:
    - condition: "距离上次驱虫 > 60天"
      action: "提醒主人购买驱虫药"
    - condition: "当地气温 > 35°C"
      action: "提醒主人准备冰垫和充足饮水"
    - condition: "主人提到出差/旅行"
      action: "询问谁来照顾自己"
```

这不是定时通知，是**基于上下文的智能触发**。

---

### 跨实体协作

召唤 Agent 之间不是孤立的。它们通过知识图谱（Knowledge Graph）相互关联。

Momo 知道妈妈可以帮忙照顾自己（因为关系图中 Momo → 被照顾方，妈妈 → 照顾者）。

当你说出差，Momo 焦虑了，但系统知道妈妈有空，就自动协调。

这就是**跨域协作**——不是你去协调，而是系统替你协调。

---

### 隐私与治理

你可能会想：把家人信息交给 AI 安全吗？

OpenOctopus 的原则：

1. **本地优先**：默认所有数据存在本地 SQLite，不上云
2. **域级隔离**：每个 Realm 的数据互相隔离，跨域引用为只读
3. **人类在环**：关键操作需要你确认，Agent 不会自作主张
4. **完整审计**：每个 Agent 的每个决定都有日志可查
5. **权限分级**：你可以控制每个 Agent 的读写范围

---

### 试试召唤你的第一个实体

想象一下：

- 召唤你的猫/狗 → 它会在你忘记铲屎时「提醒」你
- 召唤你的父母 → 再也不会忘记他们的喜好和需求
- 召唤你的车 → 自动追踪保养周期和费用
- 召唤你的年度目标 → 它会在你偷懒时「质问」你

每一个被召唤的 Agent，都是你对生活的一次**结构化关注**。

---

OpenOctopus 是 MIT 开源项目，正在积极开发中。

- GitHub: `github.com/open-octopus/openoctopus`
- Discord 社区: The Reef
- 理念：Realm 分域治理 + Summon 召唤万物

欢迎 Star、Fork、Issue，或者来 The Reef 聊聊你想召唤什么。

SUMMON! 🐙

---

## 配图方案

| 位置 | 内容 |
|---|---|
| 头图 | Summon 转化过程：灰色剪影 → 发光的活体 Agent |
| 文中 | 多 Agent 同时响应的对话界面 |
| 文中 | SOUL.md 配置可视化 |
| 文中 | 知识图谱：实体之间的关系网 |
| 文末 | OpenOctopus banner |

## 生图提示词

### 头图（Summon 转化全景）

```
A horizontal banner (2:1 ratio), dark background (#0D1117). A cinematic transformation sequence from left to right. Far left: four grey silhouettes (a dog, a woman, a car, a target icon) with scattered data fragments. Center: a large glowing octopus tentacle sweeping across the image, emitting cyan (#00D4AA) energy particles and transformation waves. Far right: the same four entities now fully alive and colorful — the dog is playful with a speech bubble, the woman is warm with a heart icon, the car has a status dashboard, the target has a progress bar. Large text "SUMMON" in the center where the transformation happens. Style: cinematic tech-fantasy, dramatic lighting, high contrast.
```

### 知识图谱图

```
A horizontal diagram (16:9 ratio), dark background (#0D1117). A network graph showing interconnected entities across realms. Central node: a user avatar. Connected to realm clusters: Pet realm (Momo node with dog icon, linked to Vet node), Family realm (Mom node, Dad node, linked to each other), Finance realm (Budget node, linked to all realms with dotted lines), Vehicle realm (Tesla node with car icon). Relationship labels on edges: "cares for", "feeds", "budgets for", "drives to". Each realm cluster has a subtle colored background (purple for pet, warm pink for family, green for finance, blue for vehicle). Nodes glow with their realm color. Style: modern knowledge graph visualization, dark theme, clean.
```
