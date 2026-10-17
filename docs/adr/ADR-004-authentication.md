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

## Amendment (2026-10-17): Google sign-in with an ID token, no client secret

The organisation's Google OAuth client is shared with another product that uses Google Identity Services and only the
client ID. The portal now uses the same model, which serves FR-ACC-006 (federated login).

- **Browser:** `GoogleSignInButton` renders Google's own button through `accounts.google.com/gsi/client`, in popup mode
  with FedCM. Before rendering, it fetches a one-time nonce from `POST /api/auth/google/nonce`, which stores a 10-minute
  httpOnly copy in a cookie.
- **Server:** `POST /api/auth/google/id-token` checks same-origin and the rate limit (`googleSignIn`, 20 per 15 min),
  then consumes the nonce cookie. `verifyGoogleIdToken` checks the RS256 signature against Google's JWKS, which is
  cached per Cache-Control and refetched once for an unknown `kid`. It also checks the issuer, the audience (must equal
  `GOOGLE_CLIENT_ID`), expiry with 60 s skew, and the nonce. No package was added: the check uses `node:crypto`.
- **Account rules are unchanged:** the identity goes through `handleGoogleIdentity`. A verified email is required,
  there is never a silent merge into a password account, MFA still applies, and linking still needs a recent password
  confirmation (SEC-005).
- **Configuration:** only `GOOGLE_CLIENT_ID` is required. Every site address must be listed in the client's
  "Authorised JavaScript origins". The Arctic redirect flow (`/api/auth/google` with its callback) stays for deployments
  that also set `GOOGLE_CLIENT_SECRET`, but the UI no longer links to it.
- **CSP:** `script-src`, `style-src`, `connect-src` and `frame-src` allow `https://accounts.google.com/gsi/…` only.

## Amendment (2026-10-17): staff two-step is recommended, enforceable by configuration

The product owner asked that staff still be sent to set up two-step, but be able to skip it and use the portal
normally. FR-ACC-004 requires two-step for back-office roles, so mandatory mode stays available as a switch.

- **Policy:** a single helper, `server/auth/mfa-policy.ts`, with `mfaBlocks` and `mfaRecommended`. It is used by page
  guards (`requireUser`), server actions (`authorizeSelf`, `authorizeAction`) and route handlers (`apiUser`), so they
  can't drift apart.
  - **Two-step already set up:** the session must have passed it, always. Nobody can skip a factor they have.
  - **Two-step not set up:** blocked only when the roles call for it (`requiresMfa`) and `MFA_ENFORCE=true`.
- **Default `MFA_ENFORCE=false`:** after sign-in (password or Google), `landingFor` sends staff without two-step to
  `/settings/security?setup=required&next=…`. The page recommends it, offers "Set it up now" and the guided setup,
  and "Skip for now" returns them to `next`. After that, every page and action works without it.
- **`MFA_ENFORCE=true`:** the previous behaviour returns. Pages redirect to the security page, actions refuse, and
  the banner says "required".
- **Unchanged:** removing the last method is still refused for staff roles (`mfaRequiredForRole`). Two-step is
  optional to set up, but once on it isn't downgraded.
- **Tests:** unit tests in `mfa-policy.test.ts` cover both modes, and e2e `auth.spec` covers "guided, then skip,
  then the back office opens".
