# Ready Set Fly (RSF)

Production aviation tools-first platform.

## Deploy TFR Proxy

Use the Cloudflare Worker in [workers/rsf-tfr-proxy](workers/rsf-tfr-proxy):

```bash
npm i -g wrangler
wrangler login
wrangler deploy
```

Set this env var on the RSF backend:

```
TFR_ARCGIS_PROXY_URL=https://rsf-tfr-proxy.<your-subdomain>.workers.dev
```

## Configure RSF

Required env vars for immediate NOTAM + TFR operation:

```
TFR_ARCGIS_PROXY_URL=https://rsf-tfr-proxy.<your-subdomain>.workers.dev
NOTAM_SOURCE=http
NOTAM_HTTP_BASE_URL=https://<your-notam-provider>/notams
NOTAM_HTTP_HEADERS_JSON={"Authorization":"Bearer <token>"}
```

## TFMS Operational Intelligence (Tiered)

TFMS endpoints are gated by membership tier and can be toggled on/off:

```
TFMS_ENABLED=true
TFMS_PROVIDER=stub
TFMS_CACHE_TTL_SECONDS=300
```

Endpoints:

- `GET /api/tfms/status?dep=KDAL&dest=KATL&route=...`
- `GET /api/tfms/overlay?bbox=minLon,minLat,maxLon,maxLat`
- `GET /api/tfms/risk?dep=KDAL&dest=KATL&time=...`

## Health Checks

- `GET /api/aviation/health`
- `GET /api/tfrs`
- `GET /api/notams?icao=KJFK`

## Manual Tests

```bash
# TFR proxy
curl "https://rsf-tfr-proxy.<your-subdomain>.workers.dev/?where=1%3D1&outFields=*&returnGeometry=true&f=geojson&outSR=4326"

# NOTAMs
curl "https://readysetfly-api.onrender.com/api/notams?icao=KJFK"

# Health
curl "https://readysetfly-api.onrender.com/api/aviation/health"
```

## Tier B (Future)

A separate SWIM JMS ingestion worker can normalize NOTAMs into Postgres and serve RSF via internal endpoints.
