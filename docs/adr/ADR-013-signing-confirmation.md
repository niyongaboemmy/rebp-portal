# ADR-013 — Review and decision signing: confirmed approval instead of a password prompt

**Status:** Proposed · **Amends:** FR-L-010 ("re-authentication"), FR-M-013 · **Refs:** SEC-005, FR-M-017, UX-036

**Problem.** Officers and approvers sign many files per session. Typing the password at every review, decision
and correction slowed the work and broke the guided flow. Product asked for "a normal modern confirm modal".

**Decision.**

- Signing a review (`signReview`), recording a decision (`recordDecision`) and correcting one (`correctDecision`) no
  longer re-authenticate with the password. The contracts (`signReviewSchema`, `decisionSchema`,
  `correctDecisionSchema`) no longer carry a `password`.
- The signature is an **explicit approval in a two-step-verified session**. `authorizeAction()` still requires the
  capability and a verified MFA session on every call, because staff sessions are always MFA-verified (SEC-005). The
  signature records `method: "CONFIRMED_MFA_SESSION"` with the officer, time, IP address and user agent. The audit
  events are unchanged.
- The UI asks once, in `ConfirmSignDialog`: it shows the outcome and offers "Not yet" or "Sign". A successful signature
  opens `ValidationCelebration` (`?celebrate=<outcome>`), where the companion's mood follows the outcome.
- **Unchanged:** certificate reissue (`reissueCertificateAction`) and configuration approval still need step-up,
  because they are not approvals of an application.

**Consequences.**

- This departs from FR-L-010's "(re-authentication)". The SRS owner should confirm it or amend the requirement.
- An unattended, unlocked session could sign. Mitigations: the session idle timeout, MFA at sign-in, segregation of
  duties (BR-091) and the audit trail. Step-up could return per category (for example REBF) if the regulator asks.
- Older records keep `method: "PASSWORD_REAUTH"`. Both methods have labels.
