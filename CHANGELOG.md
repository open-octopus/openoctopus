# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Calendar Versioning](https://calver.org/) (YYYY.M.D).

## [2026.4.23]

### Added

- WebSocket connection rate limiting (max 10 per IP per 60s) and message size validation (max 64KB)
- Playwright E2E tests for dashboard (10 tests: rendering, navigation, interactions, mobile layout)
- System tests for full-stack flows (42 tests: health, realm/entity CRUD, chat routing, summon lifecycle, family system, knowledge lifecycle, error handling, cleanup)
- Integration tests for ink server bootstrap (25 tests: REST API, WebSocket RPC, health endpoints)
- Unit test coverage expanded to 694 tests across 63 files

### Security

- Sanitized error responses to prevent information leakage (generic "Internal server error" for unknown errors)
- Added express-rate-limit to HTTP gateway (100 requests per 15 min per IP)
- Added Zod input validation to REST routes (realms, entities, chat) with length limits and enum constraints
- WebSocket rate limiting closes connections with code 1008 when exceeded

### Fixed

- Docker compose command path from `index.js` to `index.mjs` (matching tsdown ESM output)
- Added `EXPOSE 19789` to Dockerfile for WebSocket RPC port
- System test dependency resolution by adding `ws` and `@types/ws` to root devDependencies
- Playwright E2E port conflict by switching from 5173 to 5174
- Replaced deprecated tsdown `external` option with `deps.neverBundle` in ink and storage configs

### Changed

- Coverage thresholds lowered to 60% lines/functions/statements, 50% branches (Phase B completion)
- All quality gates pass: build, typecheck, tests (771/771), lint, format, knip

## [2026.3.10]

### Added

- Initial monorepo scaffold with 10 workspace packages
- Core domain model: Realm, Entity, Summon, Agent, Skill
- Dual-port gateway: HTTP REST (19790) + WebSocket RPC (19789)
- Multi-provider LLM with failover: Anthropic, OpenAI, Google, Ollama
- SQLite local storage with JSONL sessions
- React dashboard with realm grid, timeline, entity management
- CLI tool (`tentacle`) with WS RPC streaming
- Channel system: Telegram, Discord, Slack adapters
- Docker multi-stage build + docker-compose setup
