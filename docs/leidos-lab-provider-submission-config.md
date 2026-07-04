# Leidos LAB Provider Submission Configuration

Actual Leidos LAB HTTP submission is guarded in:

`server/services/flight-plan-filing/provider.ts`

The provider reads:

`LEIDOS_FLIGHT_SERVICE_ENABLE_LIVE=true`

If this flag is not enabled, RSF stages the filing request locally and returns:

`Live provider submission remains disabled until RSF enables Leidos in environment configuration.`

For LAB certification runs, keep the environment pointed at LAB:

- `FLIGHT_SERVICE_ENVIRONMENT=LAB` or `LEIDOS_FLIGHT_SERVICE_ENV=LAB`
- `LEIDOS_FLIGHT_SERVICE_REST_BASE_URL` must remain the Leidos LAB endpoint
- `LEIDOS_LAB_TEST_ENABLED=true`
- `LEIDOS_FLIGHT_SERVICE_ENABLE_LIVE=true`

Do not use production operational filing flags for LAB certification:

- Do not set `FLIGHT_FILING_OPERATIONAL_ENABLED=true` for LAB certification.
- Production operational filing is separately gated and only applies when `FLIGHT_SERVICE_ENVIRONMENT=PRODUCTION`.

The live LAB certification runner verifies the endpoint is LAB before allowing provider submission.
