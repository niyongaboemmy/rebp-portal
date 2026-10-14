# Architecture decision records

| ADR                                     | Decision                                                              | Status             |
| --------------------------------------- | --------------------------------------------------------------------- | ------------------ |
| [001](ADR-001-monorepo.md)              | pnpm + Turborepo monorepo; Next.js app with a domain layer            | Accepted (amended) |
| [002](ADR-002-contracts.md)             | Shared Zod contracts package drives UI and server validation          | Accepted           |
| [004](ADR-004-authentication.md)        | Custom session authentication with TOTP/SMS/email MFA and Google OIDC | Accepted           |
| [005](ADR-005-adapters.md)              | Adapter pattern for external systems, mocks in the pilot              | Accepted           |
| [007](ADR-007-audit-trail.md)           | Append-only, hash-chained audit trail                                 | Accepted           |
| [008](ADR-008-frontend-foundation.md)   | Design system, typography, i18n and responsiveness                    | Accepted (amended) |
| [009](ADR-009-visual-language.md)       | Visual language: navy palette (v2), Ink dark theme, motion, graphics  | Proposed           |
| [010](ADR-010-public-locale-routing.md) | Locale-prefixed URLs and hreflang for public pages                    | Proposed           |

ADR-003 (state machines) and ADR-006 (register projection) are written when those modules start (D2–D4).
