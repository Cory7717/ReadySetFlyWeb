import dgram from "node:dgram";
import http from "node:http";

const UDP_PORT = Number(process.env.RSF_RECEIVER_UDP_PORT || 4000);
const UDP_HOST = process.env.RSF_RECEIVER_UDP_HOST || "0.0.0.0";
const HTTP_PORT = Number(process.env.RSF_RECEIVER_HTTP_PORT || 3005);
const HTTP_HOST = process.env.RSF_RECEIVER_HTTP_HOST || "127.0.0.1";
const HTTP_PATH = process.env.RSF_RECEIVER_HTTP_PATH || "/rsf-live.json";
const STALE_MS = Number(process.env.RSF_RECEIVER_STALE_MS || 45000);
const HEALTH_PATH = process.env.RSF_RECEIVER_HEALTH_PATH || "/health.json";
const STATUS_PAGE_PATH = process.env.RSF_RECEIVER_STATUS_PATH || "/";

const MESSAGE_LABELS = {
  0x00: "Heartbeat",
  0x0a: "Ownship report",
  0x0b: "Ownship geometric altitude",
  0x14: "Traffic report",
};

const state = {
  bridgeStartedAt: Date.now(),
  ownship: null,
  traffic: new Map(),
  lastFrameAt: 0,
  lastMessageId: null,
  lastOwnshipAt: 0,
  lastTrafficAt: 0,
  lastHeartbeatAt: 0,
  lastHeartbeat: null,
  lastDecodeError: null,
  stats: {
    datagramsReceived: 0,
    framesReceived: 0,
    validFrames: 0,
    shortFrames: 0,
    crcErrors: 0,
    messagesReceived: 0,
    ownshipReports: 0,
    trafficReports: 0,
    heartbeatReports: 0,
    unknownReports: 0,
    rejectedReports: 0,
    messageCounts: {},
  },
};

function toIsoOrNull(timestamp) {
  return timestamp ? new Date(timestamp).toISOString() : null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMessageLabel(messageId) {
  const label = MESSAGE_LABELS[messageId];
  return label || `Message 0x${Number(messageId).toString(16).padStart(2, "0").toUpperCase()}`;
}

function decodeSigned24(buffer, offset) {
  let value = (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2];
  if (value & 0x800000) {
    value -= 0x1000000;
  }
  return value;
}

function decodeLatLon(buffer, offset) {
  const raw = decodeSigned24(buffer, offset);
  const decoded = (raw * 180) / 8388608;
  return Number.isFinite(decoded) && decoded >= -180 && decoded <= 180 ? decoded : null;
}

function decodeAltitudeFt(buffer, offset) {
  const encoded = ((buffer[offset] << 4) | (buffer[offset + 1] >> 4)) & 0x0fff;
  const decoded = encoded * 25 - 1000;
  return Number.isFinite(decoded) && decoded >= -1000 && decoded <= 101350 ? decoded : null;
}

function decodeGroundSpeedKt(buffer, offset) {
  const encoded = ((buffer[offset] << 4) | (buffer[offset + 1] >> 4)) & 0x0fff;
  return encoded === 0 || encoded === 0x0fff ? null : encoded;
}

function decodeVerticalRateFpm(buffer, offset) {
  let encoded = ((buffer[offset] & 0x0f) << 8) | buffer[offset + 1];
  if (encoded & 0x800) {
    encoded -= 0x1000;
  }
  const decoded = encoded * 64;
  return Number.isFinite(decoded) && Math.abs(decoded) <= 65000 ? decoded : null;
}

function decodeHeadingDeg(byte) {
  return byte === 0 ? null : Math.round((byte * 360) / 256);
}

function decodeCallsign(buffer, offset, length = 8) {
  return buffer
    .subarray(offset, offset + length)
    .toString("ascii")
    .replace(/[^\x20-\x7E]/g, "")
    .trim() || null;
}

function unescapeFrame(frame) {
  const bytes = [];
  for (let i = 0; i < frame.length; i += 1) {
    const value = frame[i];
    if (value === 0x7d && i + 1 < frame.length) {
      bytes.push(frame[i + 1] ^ 0x20);
      i += 1;
    } else {
      bytes.push(value);
    }
  }
  return Buffer.from(bytes);
}

function computeCrcCcitt(buffer, seed = 0) {
  let crc = seed & 0xffff;
  for (const value of buffer) {
    crc ^= value << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc & 0xffff;
}

function validateFrame(frame) {
  if (frame.length <= 2) return false;
  const payload = frame.subarray(0, frame.length - 2);
  const trailerMsb = (frame[frame.length - 2] << 8) | frame[frame.length - 1];
  const trailerLsb = (frame[frame.length - 1] << 8) | frame[frame.length - 2];
  const candidates = [
    computeCrcCcitt(payload, 0x0000),
    computeCrcCcitt(payload, 0xffff),
  ];
  return candidates.some((computed) => computed === trailerMsb || computed === trailerLsb);
}

function parseHeartbeat(payload) {
  return {
    statusByte1: payload[1] ?? 0,
    statusByte2: payload[2] ?? 0,
    utcSeconds: payload.length >= 7 ? payload.readUInt16BE(4) : null,
    timestamp: Date.now(),
  };
}

function parseOwnshipReport(payload) {
  if (payload.length < 27) return null;
  const lat = decodeLatLon(payload, 5);
  const lon = decodeLatLon(payload, 8);
  if (lat === null || lon === null || Math.abs(lat) > 90) return null;
  return {
    lat,
    lon,
    altitudeFt: decodeAltitudeFt(payload, 11),
    speedKt: decodeGroundSpeedKt(payload, 14),
    headingDeg: decodeHeadingDeg(payload[17]),
    callsign: decodeCallsign(payload, 19),
    timestamp: Date.now(),
  };
}

function parseTrafficReport(payload) {
  if (payload.length < 28) return null;
  const lat = decodeLatLon(payload, 5);
  const lon = decodeLatLon(payload, 8);
  if (lat === null || lon === null || Math.abs(lat) > 90) return null;
  const address = payload.subarray(2, 5).toString("hex").toUpperCase();
  return {
    id: address,
    callsign: decodeCallsign(payload, 19),
    lat,
    lon,
    altitudeFt: decodeAltitudeFt(payload, 11),
    groundSpeedKt: decodeGroundSpeedKt(payload, 14),
    headingDeg: decodeHeadingDeg(payload[17]),
    verticalRateFpm: decodeVerticalRateFpm(payload, 16),
    category: payload[18] ? `CAT-${payload[18]}` : null,
    onGround: Boolean(payload[0] & 0x08),
    updatedAt: Date.now(),
  };
}

function pruneTraffic() {
  const cutoff = Date.now() - STALE_MS;
  for (const [id, target] of state.traffic.entries()) {
    if ((target.updatedAt || 0) < cutoff) {
      state.traffic.delete(id);
    }
  }
}

function handlePayload(payload) {
  const messageId = payload[0];
  const now = Date.now();
  state.lastFrameAt = now;
  state.lastMessageId = messageId;
  state.stats.messagesReceived += 1;
  state.stats.messageCounts[messageId] = (state.stats.messageCounts[messageId] || 0) + 1;

  if (messageId === 0x00) {
    state.stats.heartbeatReports += 1;
    state.lastHeartbeatAt = now;
    state.lastHeartbeat = parseHeartbeat(payload);
    return;
  }

  if (messageId === 0x0a) {
    const ownship = parseOwnshipReport(payload);
    if (ownship) {
      state.ownship = ownship;
      state.lastOwnshipAt = now;
      state.stats.ownshipReports += 1;
    } else {
      state.stats.rejectedReports += 1;
      state.lastDecodeError = "Ownship report could not be decoded.";
    }
    return;
  }

  if (messageId === 0x14) {
    const traffic = parseTrafficReport(payload);
    if (traffic?.id) {
      state.traffic.set(traffic.id, traffic);
      state.lastTrafficAt = now;
      state.stats.trafficReports += 1;
    } else {
      state.stats.rejectedReports += 1;
      state.lastDecodeError = "Traffic report could not be decoded.";
    }
    return;
  }

  state.stats.unknownReports += 1;
}

function handleDatagram(message) {
  state.stats.datagramsReceived += 1;
  let start = -1;
  for (let i = 0; i < message.length; i += 1) {
    if (message[i] !== 0x7e) continue;
    if (start === -1) {
      start = i + 1;
      continue;
    }
    const rawFrame = message.subarray(start, i);
    start = i + 1;
    state.stats.framesReceived += 1;
    if (rawFrame.length <= 2) {
      state.stats.shortFrames += 1;
      continue;
    }
    const unescaped = unescapeFrame(rawFrame);
    if (unescaped.length <= 3) {
      state.stats.shortFrames += 1;
      continue;
    }
    if (!validateFrame(unescaped)) {
      state.stats.crcErrors += 1;
      state.lastDecodeError = "CRC validation failed.";
      continue;
    }
    state.stats.validFrames += 1;
    state.lastDecodeError = null;
    const payload = unescaped.subarray(0, unescaped.length - 2);
    handlePayload(payload);
  }
}

function buildHealthSummary() {
  pruneTraffic();
  const now = Date.now();
  const lastFrameAgeMs = state.lastFrameAt ? now - state.lastFrameAt : null;
  const lastOwnshipAgeMs = state.lastOwnshipAt ? now - state.lastOwnshipAt : null;
  const lastTrafficAgeMs = state.lastTrafficAt ? now - state.lastTrafficAt : null;
  const lastHeartbeatAgeMs = state.lastHeartbeatAt ? now - state.lastHeartbeatAt : null;

  let status = "idle";
  if (state.lastFrameAt) {
    if ((lastFrameAgeMs ?? Infinity) > STALE_MS) {
      status = "stale";
    } else if ((lastOwnshipAgeMs ?? Infinity) <= STALE_MS) {
      status = "healthy";
    } else {
      status = "traffic-only";
    }
  }

  const warnings = [];
  if (status === "stale") warnings.push("Receiver data has gone stale.");
  if (status === "traffic-only") warnings.push("Traffic frames are arriving, but no fresh ownship report is available.");
  if (!state.lastHeartbeatAt) warnings.push("No GDL-90 heartbeat has been seen yet.");
  if (state.lastDecodeError) warnings.push(state.lastDecodeError);

  return {
    status,
    staleMs: STALE_MS,
    bridgeStartedAt: toIsoOrNull(state.bridgeStartedAt),
    lastFrameAt: toIsoOrNull(state.lastFrameAt),
    lastOwnshipAt: toIsoOrNull(state.lastOwnshipAt),
    lastTrafficAt: toIsoOrNull(state.lastTrafficAt),
    lastHeartbeatAt: toIsoOrNull(state.lastHeartbeatAt),
    bridgeAgeMs: now - state.bridgeStartedAt,
    lastFrameAgeMs,
    lastOwnshipAgeMs,
    lastTrafficAgeMs,
    lastHeartbeatAgeMs,
    lastMessageId: state.lastMessageId,
    lastHeartbeat: state.lastHeartbeat,
    warnings,
    stats: {
      ...state.stats,
      messageCounts: Object.fromEntries(
        Object.entries(state.stats.messageCounts).map(([messageId, count]) => [
          `0x${Number(messageId).toString(16).padStart(2, "0").toUpperCase()}`,
          {
            label: formatMessageLabel(Number(messageId)),
            count,
          },
        ]),
      ),
      trackedTraffic: state.traffic.size,
    },
  };
}

function buildBridgePayload() {
  const health = buildHealthSummary();
  return {
    source: "rsf-gdl90-bridge",
    updatedAt: toIsoOrNull(state.lastFrameAt) || new Date().toISOString(),
    health,
    ownship: state.ownship,
    traffic: Array.from(state.traffic.values()).map((target) => ({
      id: target.id,
      callsign: target.callsign,
      lat: target.lat,
      lon: target.lon,
      altitudeFt: target.altitudeFt,
      groundSpeedKt: target.groundSpeedKt,
      headingDeg: target.headingDeg,
      verticalRateFpm: target.verticalRateFpm,
      category: target.category,
      onGround: target.onGround,
      updatedAt: toIsoOrNull(target.updatedAt),
    })),
  };
}

function buildStatusPage(payload) {
  const ownship = payload.ownship;
  const trafficRows = payload.traffic
    .slice(0, 8)
    .map(
      (target) => `
        <tr>
          <td>${escapeHtml(target.callsign || target.id)}</td>
          <td>${target.altitudeFt ?? "--"} ft</td>
          <td>${target.groundSpeedKt ?? "--"} kt</td>
          <td>${target.headingDeg ?? "--"} deg</td>
          <td>${escapeHtml(target.updatedAt || "--")}</td>
        </tr>`,
    )
    .join("");
  const warningRows = payload.health.warnings.length
    ? payload.health.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")
    : "<li>No current warnings.</li>";
  const messageRows = Object.entries(payload.health.stats.messageCounts || {})
    .map(
      ([id, item]) => `
        <tr>
          <td>${escapeHtml(id)}</td>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.count}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RSF Receiver Bridge</title>
    <style>
      body { font-family: Segoe UI, Arial, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
      .wrap { max-width: 960px; margin: 0 auto; padding: 24px; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      .card { background: #fff; border: 1px solid #dbe4ee; border-radius: 14px; padding: 16px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04); }
      .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
      .value { font-size: 20px; font-weight: 700; margin-top: 6px; }
      .muted { font-size: 13px; color: #64748b; margin-top: 6px; }
      .healthy { color: #047857; }
      .stale, .traffic { color: #b45309; }
      .disconnected { color: #b91c1c; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; }
      th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; }
      ul { margin: 8px 0 0; padding-left: 18px; }
      code { background: #e2e8f0; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Ready Set Fly Receiver Bridge</h1>
      <p>Bridge JSON: <code>${escapeHtml(`http://${HTTP_HOST}:${HTTP_PORT}${HTTP_PATH}`)}</code></p>
      <div class="grid">
        <div class="card">
          <div class="label">Bridge status</div>
          <div class="value ${payload.health.status === "healthy" ? "healthy" : payload.health.status === "stale" ? "stale" : payload.health.status === "traffic-only" ? "traffic" : "disconnected"}">${escapeHtml(payload.health.status)}</div>
          <div class="muted">Last frame ${escapeHtml(toIsoOrNull(state.lastFrameAt) || "--")}</div>
        </div>
        <div class="card">
          <div class="label">Ownship</div>
          <div class="value">${ownship ? `${ownship.lat.toFixed(4)}, ${ownship.lon.toFixed(4)}` : "No ownship yet"}</div>
          <div class="muted">${ownship?.altitudeFt ?? "--"} ft · ${ownship?.speedKt ?? "--"} kt · ${ownship?.headingDeg ?? "--"} deg</div>
        </div>
        <div class="card">
          <div class="label">Tracked traffic</div>
          <div class="value">${payload.health.stats.trackedTraffic}</div>
          <div class="muted">${payload.health.stats.trafficReports} decoded traffic reports</div>
        </div>
        <div class="card">
          <div class="label">Validation</div>
          <div class="value">${payload.health.stats.validFrames} valid / ${payload.health.stats.framesReceived} frames</div>
          <div class="muted">${payload.health.stats.crcErrors} CRC errors · ${payload.health.stats.rejectedReports} rejected known reports</div>
        </div>
      </div>
      <div class="grid" style="margin-top:16px;">
        <div class="card">
          <div class="label">Warnings</div>
          <ul>${warningRows}</ul>
        </div>
        <div class="card">
          <div class="label">Bridge timing</div>
          <div class="muted">Started ${escapeHtml(payload.health.bridgeStartedAt || "--")}</div>
          <div class="muted">Last heartbeat ${escapeHtml(payload.health.lastHeartbeatAt || "--")}</div>
          <div class="muted">Last ownship ${escapeHtml(payload.health.lastOwnshipAt || "--")}</div>
          <div class="muted">Last traffic ${escapeHtml(payload.health.lastTrafficAt || "--")}</div>
        </div>
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="label">Message counts</div>
        <table>
          <thead><tr><th>ID</th><th>Type</th><th>Count</th></tr></thead>
          <tbody>${messageRows || '<tr><td colspan="3">No frames decoded yet.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="label">Traffic snapshot</div>
        <table>
          <thead><tr><th>Target</th><th>Altitude</th><th>Speed</th><th>Heading</th><th>Updated</th></tr></thead>
          <tbody>${trafficRows || '<tr><td colspan="5">No traffic targets cached yet.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  </body>
</html>`;
}

const udpServer = dgram.createSocket("udp4");
udpServer.on("message", handleDatagram);
udpServer.on("error", (error) => {
  console.error("RSF receiver bridge UDP error:", error);
});
udpServer.bind(UDP_PORT, UDP_HOST, () => {
  console.log(`RSF receiver bridge listening for GDL-90 UDP on ${UDP_HOST}:${UDP_PORT}`);
});

const httpServer = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const payload = buildBridgePayload();

  if (req.url === STATUS_PAGE_PATH) {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(buildStatusPage(payload));
    return;
  }

  if (req.url.startsWith(HEALTH_PATH) || req.url.startsWith(HTTP_PATH)) {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(payload, null, 2));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

httpServer.listen(HTTP_PORT, HTTP_HOST, () => {
  console.log(`RSF receiver bridge serving ${HTTP_HOST}:${HTTP_PORT}${HTTP_PATH}`);
});
