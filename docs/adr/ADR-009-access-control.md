# ADR-009 — Role-based access control with a governed, editable matrix

**Status:** Accepted · **Refs:** SEC-004, SEC-005, SEC-011, SRS Appendix D, §16.3 #6, BR-091

## Decision

- **Defaults in code, overrides in data.** `@rebp/contracts` holds the SRS Appendix D baseline
  (`DEFAULT_PERMISSIONS`). Administrators override individual role × capability cells; only cells that
  differ from the default are stored (`RolePermission`). Removing a row restores the default.
- **Every saved matrix must pass `validateMatrix`:**
  - no role holds both `review.perform` and `decision.make` (segregation of duties);
  - no role holds both `config.edit` and `config.approve` (maker-checker);
  - `SYSTEM_ADMIN` always keeps `users.manage`, `roles.manage`, `access.view`; staff always keep `backoffice.access` (no lock-out);
  - "staff" capabilities can only go to staff roles, which require MFA.
- **Effective permissions** = union over a user's roles. Server guards (`requireCapability`, `authorizeAction`) and navigation use the
  effective matrix, cached in-process (30 s TTL, invalidated on write).
- **People management:** no self-service changes to one's own access; at least one active system administrator must remain;
  staff roles can't be given to firm accounts. Combining review + decision roles on one person is allowed with a warning,
  because BR-091 is enforced per application.
- **Disabling** an account blocks every sign-in path and revokes all sessions immediately.
- **Privileged writes** (roles, status, matrix) require an MFA-verified session and step-up re-authentication, and are audited.
  The affected person is notified when their roles change.

## Consequences

- Access is transparent: every user has a "My access" page; auditors get a read-only console.
- The matrix is changed by a single administrator with step-up; a full maker-checker approval flow for matrix changes is R2 (FR-ADM).
- With several instances, other nodes see matrix changes within the cache TTL (30 s).
