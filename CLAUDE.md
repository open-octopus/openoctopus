# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenOctopus is a **Realm-native** personal life assistant Agent system. It organizes life into autonomous domains (Realms) — each with its own knowledge base, Agent team, and skill set — and provides a **Summon** mechanism to transform real-world entities into living AI Agents with memory, personality, and proactive behavior.

**Status:** Pre-development / design phase. No source code or build system exists yet. The repository currently contains design documentation and research only.

## Planned Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js >= 22 + TypeScript |
| Gateway | Unified orchestration entry (ref: OpenClaw Gateway) |
| Client | Web Dashboard (Realm Matrix) + CLI (`tentacle`) |
| Data | SQLite (local-first) + PostgreSQL/Supabase (optional sync) |
| Vector Search | pgvector / local vector library (per-Realm sharding) |
| Plugins | Skill mechanism + Realm Package spec |

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

## Architecture

```
OpenOctopus Core (Central Brain)
├── Router Agent — intent recognition and Realm routing
├── Cross-Realm Coordinator — knowledge sync across domains
├── Knowledge Graph — cross-domain entity relationships
└── Global Skills

Per-Realm (×12 defaults: home, vehicle, pet, parents, partner, friends, finance, work, legal, hobby, fitness, health):
├── Entities + Summon configs
├── Realm Agents (professional) + Summoned Agents
├── Realm Skills
├── Memory / Knowledge base
└── Actions / Insights

RealmHub — marketplace for sharing complete Realm packages (templates + agents + skills)
```

**Interaction models:** automatic intent routing, explicit Realm entry, cross-Realm coordination, summoned entity dialogue, multi-agent collaboration.

**Knowledge flow:** Dialogue → extract key info → update entity properties → enrich Realm KB → update cross-realm graph.

## Naming Conventions & Ecosystem

| Component | Name | Purpose |
|-----------|------|---------|
| CLI tool | `tentacle` | Command-line interface |
| Agent gateway | `ink` | Information flow medium |
| Summon engine | `summon` | Entity summoning core |
| Realm marketplace | `RealmHub` | Domain package distribution |
| Community | `The Reef` | User community |
| Realm config file | `REALM.md` | Domain definition |
| Entity personality file | `SOUL.md` | Summoned entity character |

## Key Design Decisions

- **Realm over Area/Domain/Arm:** "Realm" chosen for its autonomous-territory semantics matching the octopus tentacle metaphor (each tentacle has independent nerve center).
- **Summon over Reify/Animate/Awaken:** "Summon from the deep" is the octopus's iconic imagery; zero explanation cost in both English and Chinese.
- **Local-first architecture:** SQLite local storage with optional cloud sync via PostgreSQL/Supabase.
- **Realm packages over individual skills:** RealmHub shares complete domain solutions (entity templates + agent configs + skills + sample data), not just individual skills.

## Documentation Structure

- `docs/project-spec.md` — Product positioning, RealmHub mechanism, information architecture, milestones
- `docs/design-discussion.md` — Deep design decisions: Realm naming, Summon mechanism, layered architecture, cross-domain coordination, Entity schema
- `docs/branding.md` — Brand identity, color palette (Deep Ocean Blue #1E3A5F, Octopus Purple #6C3FA0, Summon Cyan #00D4AA), ecosystem naming
- `docs/research/` — Market research, scenario mapping, 90-day roadmap, reference sources

## Language Note

Documentation is primarily in Chinese with English terminology for core concepts. Code and technical interfaces should use English. The five core terms (Realm, Entity, Summon, Agent, Skill) are always written in English, even in Chinese text.
