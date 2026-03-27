# RSF Receiver Bridge

The RSF receiver bridge is a small local helper that listens for GDL-90 UDP from a portable ADS-B receiver and exposes a local JSON feed that `Live Flight Map` can poll.

## What it does

- listens for GDL-90 UDP on `0.0.0.0:4000`
- validates frames before decoding them
- decodes:
  - heartbeat
  - ownship report
  - traffic report
- serves:
  - status page: `http://127.0.0.1:3005/`
  - JSON feed: `http://127.0.0.1:3005/rsf-live.json`
  - health JSON alias: `http://127.0.0.1:3005/health.json`

## Quick start

From the repo root:

```powershell
npm run receiver:bridge
```

On Windows, you can also use:

```powershell
npm run receiver:bridge:windows
```

Or double-click:

```text
scripts/receiver-bridge-launch.cmd
```

## In RSF

1. Open `Live Flight Map`
2. Set `Position source` to `Receiver bridge`
3. Leave the bridge URL as:

```text
http://127.0.0.1:3005/rsf-live.json
```

4. Start live tracking

## Health states

- `Healthy`: ownship is fresh and the bridge is receiving valid frames
- `Traffic only`: traffic is arriving but a fresh ownship report is not
- `Stale`: frames have stopped arriving within the bridge stale window
- `Disconnected`: RSF cannot reach the local bridge URL

## Packaging

To build a small handoff bundle for testers:

```powershell
npm run receiver:bridge:package
```

That creates:

```text
dist/receiver-bridge/
```

with the bridge script, launchers, and this guide.
