# ADR-001 — Monorepo and application structure

**Status:** Accepted, amended 2026-10-14 · **Refs:** SRS §16.1, NFR-MNT-001, Plan §6.2

## Context

The plan calls for a modular monolith: a NestJS API plus a Next.js front end in one repository.

## Decision

- pnpm workspaces + Turborepo. `apps/web` (Next.js 16) and `packages/contracts` exist today.
- **Amendment:** identity, sessions and audit are implemented in `apps/web/src/server/**` as a framework-agnostic
  domain layer (no React or Next imports, apart from `cookies.ts`, `current.ts`, `guards.ts` and `request-context.ts`),
  called from server actions and route handlers. This delivered working authentication without a second
  runtime. `apps/api` (NestJS) is introduced when the first domain module needs background workers or a
  partner API (WP-1.1 / R2). The domain modules then move there unchanged and server actions call the API.

## Consequences

- One deployable for the pilot; less infrastructure.
- Module boundaries are kept by folder (`server/auth`, `server/audit`, `server/notifications`) and lint rules.
- The move to NestJS is a relocation, not a rewrite, as long as domain code stays free of Next.js imports.
