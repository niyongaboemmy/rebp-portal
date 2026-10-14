# ADR-005 — Adapters for external systems

**Status:** Accepted · **Refs:** INT-*, Plan E10/E15

Notifications go through `server/notifications`: email via SMTP when `SMTP_HOST` is set (Mailpit locally),
otherwise logged; SMS uses a mock provider. Every message is recorded in `NotificationLog` (bodies only outside
production) and visible at `/dev/outbox` in development. Payment, identity and registry adapters follow the same pattern.
