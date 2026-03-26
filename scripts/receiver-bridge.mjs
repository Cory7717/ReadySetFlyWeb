import dgram from "node:dgram";
import http from "node:http";

const UDP_PORT = Number(process.env.RSF_RECEIVER_UDP_PORT || 4000);
const UDP_HOST = process.env.RSF_RECEIVER_UDP_HOST || "0.0.0.0";
const HTTP_PORT = Number(process.env.RSF_RECEIVER_HTTP_PORT || 3005);
const HTTP_HOST = process.env.RSF_RECEIVER_HTTP_HOST || "127.0.0.1";
const HTTP_PATH = process.env.RSF_RECEIVER_HTTP_PATH || "/rsf-live.json";
const STALE_MS = Number(process.env.RSF_RECEIVER_STALE_MS || 45000);

const state = {
  ownship: null,
  traffic: new Map(),
  lastFrameAt: 0,
};

function decodeSigned24(buffer, offset) {
  let value = (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2];
  if (value & 0x800000) {
    value -= 0x1000000;
  }
  return value;
}

function decodeLatLon(buffer, offset) {
  const raw = decodeSigned24(buffer, offset);
  return (raw * 180) / 8388608;
}

function decodeAltitudeFt(buffer, offset) {
  const encoded = ((buffer[offset] << 4) | (buffer[offset + 1] >> 4)) & 0x0fff;
  return encoded * 25 - 1000;
}

function decodeGroundSpeedKt(buffer, offset) {
  const encoded = ((buffer[offset] << 4) | (buffer[offset + 1] >> 4)) & 0x0fff;
  return encoded === 0 ? null : encoded;
}

function decodeVerticalRateFpm(buffer, offset) {
  let encoded = ((buffer[offset] & 0x0f) << 8) | buffer[offset + 1];
  if (encoded & 0x800) {
    encoded -= 0x1000;
  }
  return encoded * 64;
}

function decodeHeadingDeg(byte) {
  return Math.round((byte * 360) / 256);
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

function parseOwnshipReport(payload) {
  if (payload.length < 27) return null;
  return {
    lat: decodeLatLon(payload, 5),
    lon: decodeLatLon(payload, 8),
    altitudeFt: decodeAltitudeFt(payload, 11),
    speedKt: decodeGroundSpeedKt(payload, 14),
    headingDeg: decodeHeadingDeg(payload[17]),
    timestamp: Date.now(),
  };
}

function parseTrafficReport(payload) {
  if (payload.length < 28) return null;
  const address = payload.subarray(2, 5).toString("hex").toUpperCase();
  return {
    id: address,
    callsign: decodeCallsign(payload, 19),
    lat: decodeLatLon(payload, 5),
    lon: decodeLatLon(payload, 8),
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
  state.lastFrameAt = Date.now();

  if (messageId === 0x0a) {
    const ownship = parseOwnshipReport(payload);
    if (ownship) {
      state.ownship = ownship;
    }
    return;
  }

  if (messageId === 0x14) {
    const traffic = parseTrafficReport(payload);
    if (traffic?.id) {
      state.traffic.set(traffic.id, traffic);
    }
  }
}

function handleDatagram(message) {
  let start = -1;
  for (let i = 0; i < message.length; i += 1) {
    if (message[i] !== 0x7e) continue;
    if (start === -1) {
      start = i + 1;
      continue;
    }
    const rawFrame = message.subarray(start, i);
    start = i + 1;
    if (rawFrame.length <= 2) continue;
    const unescaped = unescapeFrame(rawFrame);
    if (unescaped.length <= 3) continue;
    const payload = unescaped.subarray(0, unescaped.length - 2);
    handlePayload(payload);
  }
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
  if (!req.url || !req.url.startsWith(HTTP_PATH)) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  pruneTraffic();
  const payload = {
    source: "rsf-gdl90-bridge",
    updatedAt: new Date(state.lastFrameAt || Date.now()).toISOString(),
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
    })),
  };

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
});

httpServer.listen(HTTP_PORT, HTTP_HOST, () => {
  console.log(`RSF receiver bridge serving ${HTTP_HOST}:${HTTP_PORT}${HTTP_PATH}`);
});
