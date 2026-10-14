# ADR-004 — Authentication

**Status:** Accepted · **Refs:** FR-ACC-001…010, SEC-002/005/006, ASVS L2 V2/V3

## Decision

Custom, server-side session authentication (no hosted IdP in the pilot):

| Concern      | Choice                                                                                                                                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passwords    | argon2id (m=19 MiB, t=2, p=1); ≥ 12 chars; no name/email; HIBP k-anonymity breach check (fail-open)                                                                                                                           |
| Sessions     | 256-bit random token in an HttpOnly, SameSite=Lax cookie (`__Host-` prefix in production); DB stores only SHA-256; idle 30 min (staff 15), absolute 12 h (staff 8); list and revoke; sign out everywhere                      |
| Verification | Email and SMS one-time codes (HMAC-stored, 10 min, 5 attempts, 30 s resend cooldown); both required before application functions                                                                                              |
| Two-step     | User-chosen methods: **authenticator app (TOTP, RFC 6238, replay-protected)**, **SMS**, **email**; a preferred method; switch at sign-in; 10 single-use recovery codes. Mandatory for staff and Principal Brokers             |
| Google       | OIDC via Arctic with state + PKCE. Verified email required. New accounts are created; an existing email is **never auto-merged** (sign in with password, then link from Security). Google sign-in still goes through two-step |
| Step-up      | Sensitive changes need a credential presented in the last 10 minutes (password re-entry dialog)                                                                                                                               |
| Abuse        | Per-IP rate limits (in-memory; Redis later), lockout after 5 failures for 15 min, generic errors, timing equalisation                                                                                                         |
| Recovery     | Emailed reset code; resets revoke every session and notify the user                                                                                                                                                           |
| Secrets      | TOTP secrets encrypted with AES-256-GCM (`APP_ENCRYPTION_KEY`)                                                                                                                                                                |

## Consequences

- Passkeys (FR-ACC-005) and national SSO (FR-ACC-006) are deferred; an OIDC IdP (Keycloak) remains an R2 option.
- The in-memory rate limiter assumes one instance; replace it before scaling out.
- The CSP still allows inline scripts; nonce-based CSP is an R2 hardening item.
