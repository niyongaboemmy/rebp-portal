# ADR-006 — The public register is a read-model projection

**Status:** Accepted · **Refs:** SRS §9.6, FR-REG-001…005/008, FR-WF-010, PRV-007

## Context

The public register must be fast (P95 < 1 s), typo-tolerant, and must never expose non-public data
(ID numbers, dates of birth, home addresses, contact details, Section H). Licence data lives across
`Licence`, `Registrant`, `Firm`, `Branch` and `Affiliation`, joined with personal data.

## Decision

- `RegisterEntry` is a denormalised table holding **only public fields** (name, registration and licence
  numbers, category, status, validity, firm and branch, district/province, authorised scope, public
  conditions, Principal Broker for firms, QR token, a normalised `searchText`).
- `projectLicenceWith()` (`server/licensing/projection.ts`, a pure function of a Prisma client) rebuilds an
  entry. It runs **in the same transaction** as every licence change (issue, renewal, suspension, revocation,
  correction, affiliation end, supersession), so the register is never behind the licence (FR-WF-010 asks
  for ≤ 5 minutes). The seed uses the same function.
- Search uses a GIN trigram index on `searchText` (`pg_trgm`, `word_similarity`) for typo tolerance, plus
  filters; anonymous searches are rate-limited (FR-REG-005).
- The verification page resolves an unguessable QR token or a licence number; a reissued certificate rotates
  the token and the old one answers "superseded" (FR-N-012).

## Consequences

- Public pages never touch personal tables; an automated test asserts no PII appears.
- Projection logic must be updated when a public field is added — one function, covered by integration tests.
- R2: the projection can move to an event consumer (outbox) without changing readers.
