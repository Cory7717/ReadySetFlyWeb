# Hotel Operations Phase 2 operations

## Runtime configuration

The support notification runner is PostgreSQL-backed and starts in the API process by default. No new secret is required. It uses the existing `DATABASE_URL`, `BREVO_API_KEY`, `BREVO_FROM`, `BREVO_REPLY_TO`, and `FRONTEND_BASE_URL` settings.

`HOTEL_OPS_SUPPORT_WORKER_DISABLED=true` disables execution only; it does not remove queued jobs. Leave it unset/false unless an approved separately deployed process owns the runner. At least one continuously running instance must execute the worker for the 120-second escalation service level.

## Deployment

1. Back up PostgreSQL and confirm restore access.
2. Review and approve migration `0155_add_hotel_operations_phase2.sql`.
3. Deploy the API/client from one approved commit. The production `start` command runs unapplied migrations before starting the API; migration failure prevents startup.
4. Confirm the support settings page reports Brevo configured and the support worker enabled.
5. Designate at least one support specialist and confirm their heartbeat changes availability to Online.
6. Create a non-sensitive test chat. Verify persistence, specialist reply, email notification, and tenant isolation.
7. In a controlled test, leave a chat unanswered and verify one first-response escalation is provider-accepted after the configured threshold.

Rollback application code to the prior release if necessary. Migration 0155 is additive; leave its tables in place during application rollback so persisted support records and queued notifications are not destroyed. Do not blindly drop the tables.
