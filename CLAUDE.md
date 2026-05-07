# Agent Instructions — Brede Welvaart Scan

This file is the single source of truth for AI coding agents in this repo. `CLAUDE.md` and `.github/copilot-instructions.md` are symlinks to this file, so Claude Code, GitHub Copilot, and any AGENTS.md-aware tool (Cursor, Codex, Aider) read the same guidance.

## Project

Digital tool for the City of Amsterdam to collect, review, and archive outcomes from Brede Welvaart (BW) workshops. A *Scan* contains 10 fixed topics; each topic has 1–8 arguments with sentiment (positive / negative / neutral) and threaded comments from invited reviewers. Facilitators export a finalized PDF that is archived to the council system.

See `product.md` for full domain terminology (Scan, Topic, Argument, Comment, locations, user roles).

## Concept context

This is a **Concept Team** experiment — short-cycle, user-focused web app shipped on a 3–5 month cycle. It has graduated past throwaway-spike (real users, real infra, real pipelines), so promotion-readiness rules apply: managed platform services over custom plumbing, infra and CI are non-negotiable, and the app must remain promotable to a full workload by adding rather than rewriting.

## Skills (read before acting in their domain)

These skills are pinned in `skills-lock.json` and hydrated into `.agents/skills/` by the `prepare` hook on `pnpm install` (via the [`skills`](https://www.npmjs.com/package/skills) CLI). The directory is `.gitignore`'d — re-run `pnpm install` after pulling if it goes missing. Use the skills as the source of truth for their topics — do not re-derive guidance.

- **`concept-development`** — overall mindset, architecture defaults, decision checklist for any new module or service.
- **`developers-amsterdam`** — engineering standards: Conventional Commits, branch protection, tests (~70–80% coverage), security-by-design, accessibility.
- **`amsterdam-design-system`** — `@amsterdam/design-system-react`, `--ams-*` tokens, BEM `ams-` classes, Compact mode, Tailwind bridge for layout only. Mandatory for all UI work.
- **`amsterdam-stijl`** — Dutch tone of voice (Heldere Taal B1, active voice, inclusive). Mandatory for all user-facing copy.

## Stack

- **Monorepo:** pnpm workspaces (`pnpm-workspace.yaml`). Use `pnpm`, never `npm` or `yarn` (`preinstall` blocks others). *Note: `concept-development` defaults new concepts to bun workspaces — this repo predates that and stays on pnpm.*
- **Workspaces:** `apps/backend`, `apps/frontend`, `apps/pdf-frontend`, `apps/ai-service`, `apps/shared/types`, `apps/shared/ui`.
- **Frontend:** React + Vite + Apollo Client. Follow the `amsterdam-design-system` skill — ADS components and `--ams-*` tokens first; shadcn only as a last resort and only when restyled with ADS tokens.
- **Backend:** Node.js + Apollo GraphQL, MongoDB. Run via `tsx` (no build step). Only `apps/frontend` is built. *Note: `concept-development` defaults new concepts to PostgreSQL Flexible Server + Drizzle — this repo predates that and stays on MongoDB.*
- **Types:** GraphQL codegen → emitted to `apps/shared/types`. Run `pnpm codegen` after schema changes.
- **Auth:** Entra ID SSO (`@azure/msal-react`). Local dev uses a `DEV_USER` mock gated on non-production env.
- **AI:** `apps/ai-service` routes through the Microsoft AI Foundry / rnd-hq AI gateway. Don't call `api.openai.com` directly or hardcode model names.
- **PDF:** `apps/pdf-frontend` rendered via Puppeteer.
- **Package versions:** Pinned via the pnpm `catalog:` in `pnpm-workspace.yaml`. Reference catalog versions instead of hardcoding.

## Hosting & infra

- **Runtime:** Shared AKS (S-AKS). See `manifests/` and `pipelines/aks-*.yaml`. Helm values follow the Amsterdam `generic-helm-application` chart pattern.
- **Public ingress:** Through Shared Application Delivery Service (S-ADS) — Application Gateway listener + WAF policy. No direct internet exposure.
- **Resource group:** Lives in the existing RND subscription as `rg-rnd-<concept>-<env>`. Do not request a new subscription.
- **Secrets:** Azure Key Vault, populated by Infisical sync. Backend reads from `apps/backend/.env` for local dev only (see `.env.example`).

## Commands

- `pnpm dev` — runs backend + frontend concurrently
- `pnpm build` — builds frontend only
- `pnpm codegen` — regenerates GraphQL types into `apps/shared/types`
- `docker compose up mongodb -d` — local MongoDB

## Conventions

- **TypeScript everywhere.** Strict mode. Use catalog-pinned `typescript` and `@types/node`.
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). Branch names follow `SRDO-<ticket>-short-slug` for tracked work or `no-srdo-short-slug` for untracked.
- **Dutch UI copy** — defer to the `amsterdam-stijl` skill. Code identifiers stay in English.
- **GraphQL-first:** Define schema in `apps/backend`, regenerate types, then consume from frontend via the generated hooks. Don't hand-roll types that the codegen produces.
- **No build step for backend code** — write code that runs directly under `tsx`. Avoid build-only TS features that depend on emit (e.g. `const enum` in shared code, decorators requiring transformers without explicit config).
- **Tracer-bullet vertical slices.** Ship the thinnest end-to-end path before broadening surface area.
- **Throwability over reusability.** Don't extract shared abstractions inside this repo until two call sites demonstrably need them. Don't extract across concepts at all.
- **Editing existing files** is preferred over creating new ones. Don't add docs, READMEs, or planning files unless asked.
- **Comments:** explain *why*, not *what*. Skip narration of what the code does.

## Boundaries

- Only **facilitators** edit Scan content; **reviewers** can only comment. Enforce in resolvers, not just UI.
- Scans are editable **until finalized**. After finalization: read-only + archived PDF.
- All authenticated requests must come through Entra ID SSO — no anonymous mutations.
- All cross-package types must flow through `apps/shared/types` (codegen output) or `apps/shared/ui`.

## What to avoid

- Don't introduce alternative package managers, UI libraries (MUI, Chakra, Ant Design), or state libraries when Apollo cache or local React state suffice. Raw shadcn defaults are also out — see the `amsterdam-design-system` skill.
- Don't bypass the design system tokens with hardcoded colors / spacing.
- Don't roll custom plumbing where a managed Azure primitive exists (storage, queues, secrets, auth). If you reach for one, check the `concept-development` skill first.
- Don't write `if (env === 'dev') useFs(); else useBlob()`-style branches — use the official emulator (Azurite, local Postgres/Mongo container) so dev mirrors prod.
- Don't commit secrets — backend reads from `apps/backend/.env` (see `.env.example`); real secrets come from Key Vault via Infisical.
- Don't skip `pnpm codegen` after schema changes; stale generated types cause silent drift.
