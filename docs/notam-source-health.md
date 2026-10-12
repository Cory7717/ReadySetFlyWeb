# NOTAM source health

RSF stores one bounded health row for each NOTAM provider (`swim` and
`nms_api`). The public health response never includes broker addresses, queue
names, credentials, tokens, or raw FAA payloads.

Optional timing settings:

- `NOTAM_HEALTH_HEARTBEAT_MAX_AGE_MS` — worker heartbeat age before a source is
  stale; default `300000` (five minutes), minimum `60000`.
- `NMS_HEALTH_SUCCESS_MAX_AGE_MS` — NMS successful-sync age before the source
  is stale; default `3600000` (one hour), minimum `60000`.
- `NOTAM_HEALTH_MAX_AGE_MINUTES` — retained for the legacy aggregate data-age
  fields; default `60`.

An empty successful NMS delta updates synchronization health without changing
the last actual source-update timestamp. Low SWIM message volume does not make
the source unhealthy while its worker heartbeat, TLS session, and queue
consumer remain current.
