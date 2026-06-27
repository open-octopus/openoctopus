# OpenOctopus Web/Deployment Triage - 2026-06-27

## Repository

- GitHub: `open-octopus/openoctopus`
- Package: `openoctopus`
- Runtime: Node.js >= 22, TypeScript, pnpm workspaces
- Current status: readiness already 100 before this pass
- Ark migration baseline: remote `main` already contains `91cda63` with first-class `ark` provider support.

## Public/Domain Checks

- `https://openoctopus.ai`: connection timed out after 15 seconds from this environment
- `https://openoctopus.dev`: TLS connection failed from this environment
- `https://ai-native-2gknzsob14f42138.tcloudbaseapp.com`: HTTP 418 from TCB
- Domain planning docs list `openoctopus.ai`, `openoctopus.io`, `openoctopus.dev`, and related email aliases as pending/strategy items.

## Local State

- `cloudbaserc.json` was the only untracked item at triage time.
- Its contents identify CloudBase environment `ai-native-2gknzsob14f42138` and Cloud Run service `openoctopus`; no credential was present.
- Build outputs, runtime data, local screenshots, Playwright reports, and prompt scratch files were already ignored.

## Actions Taken

- Added `cloudbaserc.json` to `.gitignore` because it is an environment-specific deployment binding.
- Added this maintenance note with current domain and CloudBase checks.
- Re-ran the Ark migration scan and confirmed remaining provider mentions are limited to historical competitor research, not runtime configuration.

## Follow-Up

- Confirm whether `openoctopus.ai` is owned and should be the primary landing domain.
- If using CloudBase, verify the expected Cloud Run public URL and whether HTTP 418 is expected before routing a custom domain.
- If using Vercel/Cloudflare Pages for the public site, add the selected deployment config and canonical URL to README/docs.
- Keep `cloudbaserc.json` local unless the team intentionally wants to version a non-secret environment binding.

## Validation

- `git diff --check`: passed
- `scan_project.sh .`: only historical competitor research entries remain; no runtime provider/key residuals.
- Common secret pattern scan: matched environment-variable reads and Telegram webhook `secret_token` field naming; no hardcoded production credential identified
- Full monorepo tests were not rerun because this pass changed only `.gitignore` and documentation
- Global inventory refresh: completed; readiness remains 100
