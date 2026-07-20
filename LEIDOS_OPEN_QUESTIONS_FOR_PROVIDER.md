# Open Questions For Leidos

Audit date: 2026-07-20
Scope: Questions that require Leidos confirmation before RSF changes production behavior.

## 1. Vendor `webUserName` For Flight Plan Filing

The WSDL examples show `webUserName` in `/FP/file` form data, and the authorization narrative describes a vendor acting for an end user. The XML schema also appears to mark `webUserName` optional in several request structures.

Questions:

- Is `webUserName` required for vendor-filed ICAO `FileFlightPlan` requests in production?
- Is it required for `AmendFlightPlan`, `ActivateFlightPlan`, `CloseFlightPlan`, or `CancelFlightPlan`?
- If required, should RSF send the pilot's 1800WXBrief username, email address, vendor account email, or another Leidos-specific account identifier?
- Must the end user authorize RSF through the Account - Service Provider Authorization page before production filing?
- What exact provider error should RSF expect when `webUserName` or vendor authorization is missing?

## 2. RouteSearch High-Altitude Default

The WSDL states that `searchPathOption` is required when `searchOption` is `SYSTEM_RECOMMENDED`. It documents `SYSTEM_RECOMMENDED/LOW_ALTITUDE_ONLY`, and separately documents `J_ROUTE`, `Q_ROUTE`, and other route-search options.

Questions:

- For IFR requests at or above 18,000 feet, should RSF use `J_ROUTE`, `Q_ROUTE`, `ATC_RECENT_IFR_ROUTES`, or another documented option?
- Is `SYSTEM_RECOMMENDED` valid at or above 18,000 feet if `searchPathOption=LOW_ALTITUDE_ONLY` is supplied, or is that semantically wrong?
- Is there an unrestricted/all-path route-search option not visible in the current WSDL?
- Should oceanic routes such as KLAS-PHNL be skipped by RouteSearch, or is there a documented oceanic route-search mode?

## 3. Provider Push Payload Variants

RSF handles observed `flightAlert` push structures with recursive, allowlisted lifecycle parsing and deduplication. The WSDL does not include enough examples to prove every variant.

Questions:

- Can Leidos provide sample `WebServicePushFlightChange` payloads for proposed, activated, closed, cancelled, expected-route changed, ARTCC rogered, no expected route, no-op/informational, and retry deliveries?
- Which fields should RSF treat as authoritative lifecycle evidence?
- Are coded messages authoritative for lifecycle only in specific fields?
- Can generic prose in notification text ever be authoritative, or should lifecycle changes only come from typed/coded fields?
- Is `versionStamp` guaranteed to increase for lifecycle-only webhook events?
- Is provider retrieve expected to omit flight state for LAB automatic IFR activation/closure while webhooks remain authoritative?

## 4. Webhook Acknowledgement Contract

RSF returns a JSON body with `success` set to string `"true"` after accepting, ignoring duplicate, or safely no-op processing a webhook.

Questions:

- Is `{ "success": "true" }` with HTTP 200 the complete expected acknowledgement for every push endpoint?
- Should duplicates and no-op payloads also return success to prevent retries?
- Are there any retry headers or provider message IDs RSF should persist for duplicate analysis?

## 5. Terminal Action Retrieve Behavior

Leidos terminal actions have been observed to return success without a versionStamp. RSF now treats missing versionStamp after CLOSE/CANCEL as informational.

Questions:

- Is versionStamp intentionally optional after successful CLOSE and CANCEL?
- How long should `RetrieveFlightPlan` remain available after CLOSE/CANCEL?
- Can retrieve return success while omitting full payload fields after terminal actions?
- Which provider lifecycle/status fields should RSF show after terminal retrieve responses with partial data?

## 6. Production REST Hostname

The current production WSDL URL is hosted at `www.1800wxbrief.com`, while WSDL REST examples include `https://lmfsweb.afss.com/Website/rest/...`.

Questions:

- What production REST base URL should RSF use for filing after approval?
- Is `https://www.1800wxbrief.com/Website/rest/` supported for the same endpoints, or should RSF continue using `https://www.lmfsweb.afss.com/Website/rest/`?
- Will Leidos notify RSF of hostname or certificate changes before production cutover?

## 7. AFF Or Full Message Schema

The current public WSDL snapshot does not expose a complete standalone schema for every nested provider push shape RSF may receive.

Questions:

- Is there an AFF or push-notification schema package RSF should validate against?
- Are there namespace changes expected between LAB and production?
- Are there fields that Leidos considers sensitive and expects vendors not to persist?

