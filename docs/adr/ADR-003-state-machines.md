# ADR-003 — Explicit application and licence state machines

**Status:** Accepted · **Refs:** SRS §4.1–4.3, FR-WF-001/002/010…012, Plan §6.3

## Context

An application moves through 15 states and a licence through 7. Several actors (applicant, supervisor,
Principal Broker, officer, approver, registrar, scheduled jobs and the payment gateway) can trigger
moves, sometimes concurrently (a webhook and a page refresh; two confirmations arriving together).

## Decision

- The allowed transitions are data in `@rebp/contracts` (`APPLICATION_TRANSITIONS`, `canTransition`),
  unit-tested, and shared by UI and server.
- Every move goes through one helper (`server/applications/applications.ts › transition`). It checks the
  transition table, then performs a **conditional update** (`WHERE id = ? AND status = <from>`): only one
  concurrent caller can leave a state; the loser gets `staleState`. The same call writes an
  `ApplicationEvent` (the applicant's timeline, FR-PORTAL-002) and the caller records an audit event.
- Edit rights derive from state (FR-WF-002): `DRAFT` edits everything; `ACTION_REQUIRED` only the sections and
  documents the information request unlocked. The server enforces it for section saves and uploads.
- Licence status changes always write an append-only `LicenceEvent` (DB trigger blocks UPDATE/DELETE) and refresh
  the register projection in the same transaction (ADR-006).
- Time-driven transitions (expiry, grace → lapse, draft expiry, confirmation expiry) live in
  `server/jobs/lifecycle.ts` and take `now` as a parameter so they are testable by time travel.

## Consequences

- Illegal or racing transitions fail loudly instead of corrupting state; tests cover both.
- Adding a state means changing the contract table, the tone map and the UI labels — the compiler finds the gaps.
