# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenOctopus is a **Realm-native** personal life assistant Agent system. It organizes life into autonomous domains (Realms) — each with its own knowledge base, Agent team, and skill set — and provides a **Summon** mechanism to transform real-world entities into living AI Agents with memory, personality, and proactive behavior.

**Status:** Phase 1 — Vertical Slice (monorepo scaffold, core types, storage, gateway with dual-port, LLM providers, channel system, CLI with WS RPC).

## Tech Stack

| Layer             | Choice                                                          |
| ----------------- | --------------------------------------------------------------- |
| Runtime           | Node.js >= 22 + TypeScript 5.7+ (strict)                        |
| Package Manager   | pnpm (workspaces)                                               |
| Bundler           | tsdown (Rollup-based)                                           |
| Linter            | oxlint                                                          |
| Formatter         | oxfmt                                                           |
| Test              | Vitest 4 (V8 coverage, pool: forks)                             |
| Dead Code         | knip                                                            |
| DB (local)        | SQLite via better-sqlite3                                       |
| Sessions          | JSONL append-only files                                         |
| Schema Validation | Zod                                                             |
| Config            | JSON5 (~/.openoctopus/config.json5) + Zod validation            |
| Gateway           | Express 5 (HTTP bridge) + WebSocket RPC (ws)                    |
| LLM Providers     | Anthropic, OpenAI, Google, Ollama (multi-provider + failover)   |
| Channels          | grammY (Telegram), Discord.js, Slack Bolt (plugin architecture) |
| CLI               | citty + consola + WS RPC client                                 |
| Deploy            | Docker multi-stage + docker-compose (gateway + cli)             |
| Versioning        | CalVer (YYYY.M.D)                                               |

## Monorepo Structure

```
packages/
├── shared/    @openoctopus/shared    — types, errors, IDs, logger, constants, config, RPC protocol
├── storage/   @openoctopus/storage   — SQLite, migrations, JSONL sessions, repos
├── core/      @openoctopus/core      — realm manager, entity manager, agent runner, LLM providers, router
├── summon/    @openoctopus/summon    — SOUL.md parser, prompt compiler, summon engine
├── channels/  @openoctopus/channels  — channel adapters (Telegram, Discord, Slack, WeChat)
├── ink/       @openoctopus/ink       — Express+WS gateway, RPC handlers, API endpoints
├── tentacle/  @openoctopus/tentacle  — CLI tool with WS RPC streaming
├── realmhub/  @openoctopus/realmhub  — package registry client (Phase 3)
└── dashboard/ @openoctopus/dashboard — Next.js web UI (Phase 2)
```

**Dependency graph:** `shared → storage, core → summon, channels → ink → tentacle`

## Commands

```bash
pnpm build           # Build all packages (8 packages)
pnpm dev             # Dev mode (ink gateway with hot-reload)
pnpm test:unit       # Run unit tests (51 tests)
pnpm test:integration # Run integration tests
pnpm typecheck       # TypeScript project-reference build
pnpm lint            # oxlint
pnpm format          # oxfmt
pnpm knip            # Dead code detection
pnpm check           # typecheck + lint + format check
```

## Core Domain Model

```
Realm -> Entity -> [Summon] -> Agent Team -> Skill -> Action / Insight
```

**Five foundational concepts:**

- **Realm** — Autonomous life domain (pet, finance, legal, health, etc.). Like an octopus tentacle with its own nerve center.
- **Entity** — Object within a Realm. Types: `living` (people/pets), `asset` (car/house), `organization`, `abstract` (goals/projects).
- **Summon** — Transforms an Entity into a living AI Agent with memory, personality, and proactive behavior. Core differentiator.
- **Agent** — Three tiers: Central (Router, Cross-Realm Coordinator, Scheduler), Realm (professional domain agents), Summoned (entity-derived agents).
- **Skill** — Two scopes: Global Skills (search, calendar, email) available to all Realms, and Realm Skills (domain-specific like vet queries, tax calculation).

## Naming Conventions & Ecosystem

| Component               | Name       | Purpose                                                    |
| ----------------------- | ---------- | ---------------------------------------------------------- |
| CLI tool                | `tentacle` | Command-line interface                                     |
| Agent gateway           | `ink`      | Information flow medium (dual-port: WS 19789 + HTTP 19790) |
| Summon engine           | `summon`   | Entity summoning core                                      |
| Channel system          | `channels` | Messaging platform adapters (Telegram, Discord, etc.)      |
| Realm marketplace       | `RealmHub` | Domain package distribution                                |
| Community               | `The Reef` | User community                                             |
| Realm config file       | `REALM.md` | Domain definition                                          |
| Entity personality file | `SOUL.md`  | Summoned entity character                                  |

## Key Design Decisions

- **Realm over Area/Domain/Arm:** "Realm" chosen for its autonomous-territory semantics matching the octopus tentacle metaphor.
- **Summon over Reify/Animate/Awaken:** "Summon from the deep" is the octopus's iconic imagery.
- **Local-first architecture:** SQLite local storage with optional cloud sync via PostgreSQL/Supabase.
- **Realm packages over individual skills:** RealmHub shares complete domain solutions.
- **Custom agent runtime:** Borrows patterns from Mastra, Google ADK, CrewAI, Eliza, Letta, OpenClaw, and LangGraph.
- **Dual-port gateway (OpenClaw pattern):** Port 19789 for WebSocket RPC, port 19790 for HTTP REST bridge.
- **Multi-provider LLM with failover:** Supports Anthropic, OpenAI, Google, Ollama with priority-based failover.
- **JSON5 config system (OpenClaw pattern):** `~/.openoctopus/config.json5` with env var interpolation and Zod validation.
- **Channel plugin architecture (OpenClaw pattern):** Extensible adapters for Telegram, Discord, Slack, WeChat, etc.

## Gateway Architecture

**Port 19789 — WebSocket RPC (primary gateway):**

- JSON-RPC protocol for CLI-to-gateway streaming
- Methods: `chat.send`, `realm.list/get/create`, `entity.list/get`, `summon.invoke/release`, `status.health`
- Events: `chat.token` (streaming), `chat.done`, `channel.message`

**Port 19790 — HTTP REST Bridge:**

- `GET /healthz`, `/readyz` — health checks
- `CRUD /api/realms`, `/api/entities` — resource management
- `POST /api/chat` — auto-routed chat
- `POST /api/chat/realm/:id` — realm-scoped chat
- `POST /api/chat/entity/:id` — summoned entity chat
- `ws://localhost:19790/ws` — WebSocket (backward compat)

## Configuration

Config file: `~/.openoctopus/config.json5` (JSON5 with comments)

```
tentacle config init      # Create default config
tentacle config show      # Show current config
tentacle config validate  # Validate config file
```

Env vars auto-configure LLM providers: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`.

## Docker Deployment

```bash
docker compose up gateway              # Start gateway
docker compose run --rm cli chat       # Interactive CLI
docker compose up                      # Full stack
```

## Rules

- `/tmp/openclaw-reference/` is a read-only reference repo. NEVER modify, commit, or push changes to it.
- All IDs use the format `{prefix}_{uuid}` (e.g., `realm_abc123-...`).
- Tests are colocated next to source files (`*.test.ts`).
- The five core terms (Realm, Entity, Summon, Agent, Skill) are always written in English.

## Documentation

- `docs/product/positioning.md` — Product positioning, RealmHub mechanism, milestones
- `docs/architecture/design-decisions.md` — Deep design decisions
- `docs/product/branding.md` — Brand identity, color palette
- `docs/research/` — Market research, scenario mapping, roadmap
