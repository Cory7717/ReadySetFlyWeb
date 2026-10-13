# FAA Daily Digital Obstacle File configuration

Ready Set Fly loads advisory obstacle reference data from the FAA Daily Digital
Obstacle File CSV archive. The built-in source is:

`https://aeronav.faa.gov/Obst_Data/DAILY_DOF_CSV.ZIP`

The expected ZIP member is `DOF.CSV`. The loader validates the archive,
required CSV fields, coordinates, record count, publication freshness, and the
official directory listing before replacing verified in-memory data.

## Environment variables

- `FAA_DDOF_ZIP_URL` — optional complete URL override. Leave unset in production
  to use the supported official FAA daily CSV endpoint. RSF requests both the
  built-in and overridden archive URLs exactly as configured; it does not append
  arbitrary cache-busting parameters. Do not put credentials in this value.
- `FAA_DDOF_CACHE_TTL_MS` — optional cache lifetime in milliseconds. Default:
  `43200000` (12 hours). Invalid, empty, zero, or negative values use the
  default. Valid values are clamped to 1 hour through 7 days.

No cyclical `.Dat` archive support is provided. When all four of the API's
existing `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and
`AWS_SECRET_ACCESS_KEY` settings are present, RSF stores one compressed,
verified, content-addressed archive plus a small manifest under
`reference-data/faa-obstacles/`. The manifest is written only after the archive,
so a partial write cannot replace the last-known-good pointer. On restart, RSF
checks the archive checksum, sizes, schema, record count, coordinates, and stale
window before using it. If S3 is not configured, the cache remains process-local.

The official directory listing, ZIP entry timestamp, archive size, schema, and
completeness checks are used as independent publication evidence. An HTTP
`Last-Modified` header alone is not sufficient to establish currency. A restored
durable snapshot is always presented as stale until a live FAA refresh succeeds.

The snapshot integration uses `s3:GetObject` and `s3:PutObject` for that prefix.
`s3:DeleteObject` is optional for service availability but recommended so the
previous content-addressed archive can be removed after replacement. It does not
call `s3:ListBucket`.

Obstacle data is advisory reference material. Stale results are labeled in API
metadata and clients; unavailable data must not be interpreted as a confirmed
zero-obstacle result.
