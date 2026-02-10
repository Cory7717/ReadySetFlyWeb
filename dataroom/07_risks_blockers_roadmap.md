# Risks, blockers, and roadmap

## Critical blockers (from internal analysis)

1) Owner payouts not enabled
- Requires Braintree Marketplace approval.
- Owners cannot withdraw earnings until enabled.

2) Messaging end-to-end validation
- Messaging state machine appears correct but needs full E2E test.

3) Automated rental completion
- No cron to auto-close rentals at end date.

## Medium-priority risks

- Limited rate limiting on some endpoints.
- Some file upload validation gaps.
- Potential data inconsistencies on payment failure.

## Suggested near-term roadmap

- Enable Braintree Marketplace and payouts.
- Add rental auto-complete cron job.
- Run full E2E rental test (including messaging and payouts).
- Add rate limiting and upload validation hardening.
- Close mobile parity gaps (messaging, reviews, favorites).

## TBD / confirm

- Security review results.
- Pen test or audit history.
