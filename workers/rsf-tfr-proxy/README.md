# RSF TFR Proxy (Cloudflare Worker)

This worker proxies FAA ArcGIS TFR data for Ready Set Fly (RSF).

## Deploy

```bash
npm i -g wrangler
wrangler login
wrangler deploy
```

Wrangler will print a workers.dev URL like:

```
https://rsf-tfr-proxy.<your-subdomain>.workers.dev
```

## Configure RSF

Set this env var on the RSF backend (Render):

```
TFR_ARCGIS_PROXY_URL=https://rsf-tfr-proxy.<your-subdomain>.workers.dev
```

## Test

```
https://rsf-tfr-proxy.<your-subdomain>.workers.dev/?where=1%3D1&outFields=*&returnGeometry=true&f=geojson&outSR=4326
```
