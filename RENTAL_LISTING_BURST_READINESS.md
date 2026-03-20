# Rental Listing Burst Readiness

This runbook is for sudden partner-driven traffic, such as a Cessna Pilots Association blast that sends a concentrated wave of owners into the rental listing flow.

## What Has Been Hardened

- Rental listing creates are idempotent via `submission_key`.
- Duplicate double-submits now replay the original listing instead of creating a second one.
- Listing creation and verification-submission creation are wrapped in one DB transaction.
- Verification documents now have a direct-upload path instead of requiring the app server to carry those files during the final create request.
- Structured logs are emitted for:
  - `rental_listing_create_started`
  - `rental_listing_create_committed`
  - `rental_listing_create_replayed`
  - `rental_listing_create_failed`

## Pre-Flight Checklist

- Apply migration `0052_add_aircraft_listing_submission_key.sql`.
- Confirm `AWS_S3_BUCKET` is configured in production.
- Confirm S3/browser upload CORS allows:
  - `https://readysetfly.us`
  - `https://www.readysetfly.us`
- Confirm IAM credentials allow:
  - `PutObject`
  - `GetObject`
  - `DeleteObject`
  for the verification-doc prefix.
- Confirm verification docs are stored under a private prefix such as:
  - `verification-docs/<userId>/insuranceDoc/...`
  - `verification-docs/<userId>/annualInspectionDoc/...`
- Confirm app instances do not rely on local filesystem state for verification-doc uploads.

## Load Test Command

Set a valid authenticated session cookie for a verified owner account, then run:

```powershell
$env:BASE_URL="http://localhost:5000"
$env:SESSION_COOKIE="connect.sid=YOUR_SESSION_COOKIE"
$env:CONCURRENCY="25"
$env:REQUESTS="50"
$env:DELETE_AFTER="true"
npm run test:load:aircraft
```

Notes:

- `DELETE_AFTER=true` attempts to remove the created test listings at the end.
- Run this against staging or a safe environment first.
- The script targets the JSON create path and is meant to stress the listing transaction/idempotency path.

## Suggested Test Runs

1. `CONCURRENCY=25`, `REQUESTS=25`
2. `CONCURRENCY=25`, `REQUESTS=50`
3. `CONCURRENCY=50`, `REQUESTS=100`

## Pass Criteria

- `0` duplicate listings from replay/double-submit behavior
- `0` partial states where a listing exists but its verification submission is missing when docs were supplied
- No elevated `5xx` rate
- `p95` create latency remains acceptable for the environment

## What To Watch In Logs

Search for:

- `rental_listing_create_failed`
- `rental_listing_create_replayed`
- `rental_listing_create_committed`

Healthy burst behavior looks like:

- mostly `committed`
- some `replayed` if users double-submit
- very few or zero `failed`

## Immediate Follow-Up If CPA Traffic Hits

- Watch app logs during the first hour after the blast.
- Check create error rate and create latency.
- Spot-check new rental listings and verification submissions for integrity.
- If there is elevated failure, pause partner re-promotion until the cause is isolated.
