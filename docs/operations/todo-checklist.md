# OpenOctopus 项目待办清单

> 更新时间：2026-03-10

## 基础设施（本周）

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| 1 | **注册域名** | ⬜ | 立即注册 `openoctopus.io`、`realmhub.ai`、`openoctopus.dev`（见 domain-strategy.md） |
| 2 | **确认 openoctopus.ai** | ⬜ | 确认是否为自有域名，若是则配置 DNS + SSL |
| 3 | **GitHub Repo 设置** | ⬜ | 设置 About 描述、Topics、Social Preview 图片（用 banner.png），按 social-profiles.md 配置 |
| 4 | **GitHub Org Profile** | ⬜ | 创建 `open-octopus/.github` 仓库，添加 `profile/README.md` 组织介绍页 |
| 5 | **注册社媒账号** | ⬜ | X `@openoctopus`、小红书「Open八爪鱼」、即刻、Discord Server |

## 工程脚手架（本周 ~ 下周）

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| 6 | **Monorepo 初始化** | ⬜ | 确认并提交 `packages/`、`pnpm-workspace.yaml` 等代码脚手架 |
| 7 | **CI/CD 配置** | ⬜ | 确认 `.github/` workflows（lint、test、build） |
| 8 | **Core Package 结构** | ⬜ | 定义 `@openoctopus/core` 模块划分：Realm Manager、Entity Store、Agent Router |
| 9 | **数据库 Schema** | ⬜ | 设计 SQLite schema：realms、entities、memories、agents、audit_log 表 |
| 10 | **CLI (`tentacle`) 骨架** | ⬜ | 基本命令：`tentacle realm list/create`、`tentacle summon` |

## 产品 MVP（Phase 1）

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| 11 | **Realm CRUD** | ⬜ | 创建/编辑/删除 Realm，支持 REALM.md 定义 |
| 12 | **Entity CRUD + Summon** | ⬜ | Entity 录入 → Summon 激活为 Agent，生成 SOUL.md |
| 13 | **Router Agent** | ⬜ | 自然语言意图识别 → 路由到正确 Realm |
| 14 | **Realm Agent 对话** | ⬜ | 域内 Agent 对话，带记忆持久化 |
| 15 | **Web Dashboard** | ⬜ | Realm Matrix 面板，一览所有域状态 |

## 社区与运营（持续）

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| 16 | **创建 Discord Server** | ⬜ | 按 discord-setup.md 指南搭建 The Reef |
| 17 | **发布首条 X 推文** | ⬜ | #BuildInPublic 风格，展示项目愿景 |
| 18 | **小红书首篇笔记** | ⬜ | Summon 概念介绍（宠物召唤方向最容易出圈） |
| 19 | **Product Hunt 预热** | ⬜ | 准备 Coming Soon 页面 |
| 20 | **CONTRIBUTING.md** | ⬜ | 贡献者指南，吸引开源社区参与 |

## 品牌补充

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| 21 | **OG 预览图** | ⬜ | 制作 1200x630 的 Open Graph 图，用于链接分享预览 |
| 22 | **Favicon** | ⬜ | 从 avatar.png 生成 favicon.ico + apple-touch-icon |
| 23 | **品牌素材包** | ⬜ | 整理 logo/icon 的 SVG 版本，供社区使用 |

## 优先级建议

域名注册 (1-2) → 提交代码脚手架 (6-7) → GitHub 设置 (3-4) → 社媒注册 (5) → 开始 MVP 开发 (8-15)
