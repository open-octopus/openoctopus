# 域名策略

> 调查时间：2026-03-10

## 1. 域名状态总览

| 域名 | 状态 | 注册商 | 注册时间 | 操作建议 |
|---|---|---|---|---|
| `openoctopus.ai` | 已注册 | Namecheap | 2026-02-17 | 确认是否为自有（隐私保护），若是则配置 DNS |
| `openoctopus.com` | 在售 | Namecheap/Afternic | 2025-03-28 | 可在 Afternic 议价购买 |
| `openoctopus.io` | **可注册** | — | — | 推荐立即注册 |
| `openoctopus.dev` | **可注册** | — | — | 推荐注册（.dev 需 HTTPS） |
| `realmhub.ai` | **可注册** | — | — | 强烈推荐立即注册 |
| `realmhub.com` | 在售 | GoDaddy/Afternic | 2014-11-08 | 持有 10+ 年，可能溢价 |
| `octo.me` | 已注册 | Cronon GmbH | 2009-07-13 | 德国持有 16 年，不可用 |

## 2. 优先级建议

### 立即行动（本周）

| 优先级 | 域名 | 预估成本 | 理由 |
|---|---|---|---|
| P0 | `openoctopus.io` | ~$30-40/年 | 主域名备选，技术品牌常用 |
| P0 | `realmhub.ai` | ~$50-70/年 | RealmHub 产品域名，核心生态组件 |
| P1 | `openoctopus.dev` | ~$12/年 | 开发者文档站，成本极低 |

### 确认 / 协商

| 优先级 | 域名 | 操作 |
|---|---|---|
| P0 | `openoctopus.ai` | 确认是否为自有。若是 → 配置 DNS + SSL |
| P2 | `openoctopus.com` | 通过 Afternic 询价，预算允许则购买 |
| P3 | `realmhub.com` | 低优先级，.ai 足够用 |

### 放弃

| 域名 | 原因 |
|---|---|
| `octo.me` | 持有 16 年，不太可能出售。备选方案：`octo-ai.me` 或直接不用 |

## 3. 域名用途规划

| 域名 | 用途 | 指向 |
|---|---|---|
| `openoctopus.ai` | 主站 / Landing Page | Vercel / Cloudflare Pages |
| `openoctopus.io` | 备用主站 / 重定向到 .ai | 301 → openoctopus.ai |
| `openoctopus.dev` | 开发者文档站 | Mintlify / Docusaurus |
| `realmhub.ai` | RealmHub 域包市场 | 独立站或子应用 |
| `openoctopus.com` | 品牌保护 / 重定向 | 301 → openoctopus.ai |

## 4. DNS 配置建议（以 openoctopus.ai 为例）

```
# A 记录 → Vercel
@ A 76.76.21.21

# CNAME → www 重定向
www CNAME cname.vercel-dns.com

# MX → 邮件（如使用 Zoho/Google Workspace）
@ MX 10 mx.zoho.com
@ MX 20 mx2.zoho.com

# TXT → SPF + 域名验证
@ TXT "v=spf1 include:zoho.com ~all"

# 子域名
docs CNAME [文档站地址]
hub CNAME [RealmHub 地址]
```

## 5. 邮箱规划

| 邮箱 | 用途 |
|---|---|
| `hello@openoctopus.ai` | 对外联系 |
| `dev@openoctopus.ai` | 开发者联系 |
| `security@openoctopus.ai` | 安全报告 |
| `octo@openoctopus.ai` | 吉祥物邮箱（趣味） |
