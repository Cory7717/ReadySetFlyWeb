# FAA Daily Digital Obstacle File configuration

Ready Set Fly loads advisory obstacle reference data from the FAA Daily Digital
Obstacle File CSV archive. The built-in source is:

`https://aeronav.faa.gov/Obst_Data/DAILY_DOF_CSV.ZIP`

The expected ZIP member is `DOF.CSV`. The loader validates the archive,
required CSV fields, coordinates, record count, publication freshness, and the
official directory listing before replacing verified in-memory data.

## Environment variables

- `FAA_DDOF_ZIP_URL` — optional complete URL override. Leave unset in production
  to use the supported official FAA daily CSV endpoint and its rotating cache
  key. Override URLs are requested exactly as configured; RSF does not append
  query parameters to them. Do not put credentials in this value.
- `FAA_DDOF_CACHE_TTL_MS` — optional cache lifetime in milliseconds. Default:
  `43200000` (12 hours). Invalid, empty, zero, or negative values use the
  default. Valid values are clamped to 1 hour through 7 days.

No cyclical `.Dat` archive support is provided. The cache is process-local: a
verified last-known-good copy can cover a transient refresh failure while the
process remains running, but a new process must verify an FAA archive before it
can serve obstacle data.

Obstacle data is advisory reference material. Stale results are labeled in API
metadata and clients; unavailable data must not be interpreted as a confirmed
zero-obstacle result.
