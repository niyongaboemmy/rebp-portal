# ADR-005 — Adapters for external systems

**Status:** Accepted · **Refs:** INT-*, Plan E10/E15

Notifications go through `server/notifications`: email via SMTP when `SMTP_HOST` is set (Mailpit locally),
otherwise logged; SMS uses a mock provider. Every message is recorded in `NotificationLog` (bodies only outside
production) and visible at `/dev/outbox` in development. Payment, identity and registry adapters follow the same pattern.

**Dev mode (APP_ENV=dev).** Until the mail/SMS gateway is connected, one-time codes are _simulated_: the code is kept
on the notification log (`devCode`) and returned to the interface, which shows it with a "Use code" button on every
code entry screen (verify, two-step, password reset, enrolment). `APP_ENV` defaults to `dev` outside a production build
and may be enabled on a pilot deployment, which then shows a warning banner and logs a startup warning. In `staging` and
`production` no code or message body is stored and nothing is returned to the browser. Note that in dev mode the
forgot-password screen reveals whether an email is registered (it shows a code only for real accounts).
