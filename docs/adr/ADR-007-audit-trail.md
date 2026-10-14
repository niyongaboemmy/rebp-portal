# ADR-007 — Audit trail

**Status:** Accepted · **Refs:** FR-AUD-001…003

`AuditEvent` is append-only. Each row stores `prevHash` and `hash = SHA-256(canonical JSON of the row + prevHash)`.
Writers serialise on a Postgres advisory lock so the chain never forks. A trigger rejects UPDATE, DELETE and
TRUNCATE for every role. `verifyAuditChain()` recomputes the chain (shown live at `/backoffice/audit`); tests
prove that editing a row, even with triggers bypassed, is detected. Metadata never holds raw PII.
WORM storage export is deferred.
