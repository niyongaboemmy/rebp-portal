# ADR-002 — Contracts package

**Status:** Accepted · **Refs:** Plan §5.2 "Contract-first", SEC-007

`@rebp/contracts` holds enums (categories, application types, roles), Zod schemas and the RBAC matrix
(SRS Appendix D). Client forms (`useActionForm`) and server actions parse **the same schema**; Zod messages are
i18n keys. The package is consumed as TypeScript source (`transpilePackages`), so there is no build step.
Later: Section A–N schemas and the visibility / checklist matrices (WP-0.5).
