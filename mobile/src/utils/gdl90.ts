import { Buffer } from 'buffer';
import dgram from 'react-native-udp';

export type TrafficTarget = {
  id: string;
  lat: number;
  lon: number;
  altitudeFt?: number;
  speedKts?: number;
  headingDeg?: number;
  callsign?: string;
  updatedAt: number;
};

export type OwnshipReport = {
  lat: number;
  lon: number;
  altitudeFt?: number;
  speedKts?: number;
  headingDeg?: number;
  callsign?: string;
  updatedAt: number;
};

export type HeartbeatReport = {
  statusByte1: number;
  statusByte2: number;
  updatedAt: number;
};

export type ReceiverHealth = {
  status: 'idle' | 'healthy' | 'traffic-only' | 'stale';
  staleMs: number;
  lastFrameAt: number | null;
  lastOwnshipAt: number | null;
  lastTrafficAt: number | null;
  lastHeartbeatAt: number | null;
  lastHeartbeat: HeartbeatReport | null;
  warnings: string[];
};

type FrameHandler = (frame: Uint8Array) => void;
const RECEIVER_STALE_MS = 45000;

function signExtend24(value: number) {
  return value & 0x800000 ? value | 0xff000000 : value;
}

function semicirclesToDegrees(value: number) {
  return (value * 180) / 0x800000;
}

function parseLatLon(payload: Uint8Array, offset: number) {
  if (payload.length < offset + 6) return null;
  const latRaw = (payload[offset] << 16) | (payload[offset + 1] << 8) | payload[offset + 2];
  const lonRaw = (payload[offset + 3] << 16) | (payload[offset + 4] << 8) | payload[offset + 5];
  const lat = semicirclesToDegrees(signExtend24(latRaw));
  const lon = semicirclesToDegrees(signExtend24(lonRaw));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function decodeAltitudeFt(payload: Uint8Array, offset: number) {
  if (payload.length < offset + 2) return undefined;
  const encoded = ((payload[offset] << 4) | (payload[offset + 1] >> 4)) & 0x0fff;
  const decoded = encoded * 25 - 1000;
  return Number.isFinite(decoded) ? decoded : undefined;
}

function decodeGroundSpeedKt(payload: Uint8Array, offset: number) {
  if (payload.length < offset + 2) return undefined;
  const encoded = ((payload[offset] << 4) | (payload[offset + 1] >> 4)) & 0x0fff;
  return encoded === 0 || encoded === 0x0fff ? undefined : encoded;
}

function decodeHeadingDeg(byte: number | undefined) {
  if (byte == null || byte === 0) return undefined;
  return Math.round((byte * 360) / 256);
}

function parseCallsign(bytes: Uint8Array, start: number, length: number) {
  const chars = [];
  for (let i = 0; i < length; i += 1) {
    const code = bytes[start + i];
    if (!code) continue;
    chars.push(String.fromCharCode(code));
  }
  return chars.join('').trim() || undefined;
}

function parseHeartbeat(frame: Uint8Array): HeartbeatReport | null {
  if (frame[0] !== 0x00 || frame.length < 3) return null;
  return {
    statusByte1: frame[1] ?? 0,
    statusByte2: frame[2] ?? 0,
    updatedAt: Date.now(),
  };
}

function parseOwnship(frame: Uint8Array): OwnshipReport | null {
  if (frame[0] !== 0x0a || frame.length < 27) return null;
  const coords = parseLatLon(frame, 5);
  if (!coords) return null;
  return {
    lat: coords.lat,
    lon: coords.lon,
    altitudeFt: decodeAltitudeFt(frame, 11),
    speedKts: decodeGroundSpeedKt(frame, 14),
    headingDeg: decodeHeadingDeg(frame[17]),
    callsign: parseCallsign(frame, 19, 8),
    updatedAt: Date.now(),
  };
}

function parseTraffic(frame: Uint8Array): TrafficTarget | null {
  if (frame[0] !== 0x14 || frame.length < 28) return null;
  const coords = parseLatLon(frame, 5);
  if (!coords) return null;
  const callsign = parseCallsign(frame, 19, 8);
  return {
    id: frame.slice(2, 5).reduce((acc, value) => `${acc}${value.toString(16).padStart(2, '0')}`, ''),
    lat: coords.lat,
    lon: coords.lon,
    altitudeFt: decodeAltitudeFt(frame, 11),
    speedKts: decodeGroundSpeedKt(frame, 14),
    headingDeg: decodeHeadingDeg(frame[17]),
    callsign,
    updatedAt: Date.now(),
  };
}

function decodeFrames(data: Uint8Array, onFrame: FrameHandler) {
  let buffer: number[] = [];
  let escaping = false;

  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i];
    if (byte === 0x7e) {
      if (buffer.length > 0) {
        onFrame(Uint8Array.from(buffer));
        buffer = [];
      }
      escaping = false;
      continue;
    }
    if (byte === 0x7d) {
      escaping = true;
      continue;
    }
    if (escaping) {
      buffer.push(byte ^ 0x20);
      escaping = false;
    } else {
      buffer.push(byte);
    }
  }
}

export type Gdl90Listener = {
  start: () => void;
  stop: () => void;
};

export function createGdl90Listener(
  port: number,
  onTraffic: (target: TrafficTarget) => void,
  onOwnship?: (ownship: OwnshipReport) => void,
  onError?: (err: unknown) => void,
  onHealth?: (health: ReceiverHealth) => void,
): Gdl90Listener {
  const socket = dgram.createSocket({ type: 'udp4', reusePort: true });
  let lastFrameAt: number | null = null;
  let lastOwnshipAt: number | null = null;
  let lastTrafficAt: number | null = null;
  let lastHeartbeatAt: number | null = null;
  let lastHeartbeat: HeartbeatReport | null = null;
  let healthTimer: ReturnType<typeof setInterval> | null = null;

  const emitHealth = () => {
    if (!onHealth) return;
    const now = Date.now();
    let status: ReceiverHealth['status'] = 'idle';
    if (lastFrameAt) {
      if (now - lastFrameAt > RECEIVER_STALE_MS) {
        status = 'stale';
      } else if (lastOwnshipAt && now - lastOwnshipAt <= RECEIVER_STALE_MS) {
        status = 'healthy';
      } else {
        status = 'traffic-only';
      }
    }
    const warnings: string[] = [];
    if (status === 'stale') warnings.push('Receiver data has gone stale.');
    if (status === 'traffic-only') warnings.push('Traffic is arriving, but no fresh ownship report is available.');
    if (!lastHeartbeatAt) warnings.push('No GDL-90 heartbeat has been seen yet.');
    onHealth({
      status,
      staleMs: RECEIVER_STALE_MS,
      lastFrameAt,
      lastOwnshipAt,
      lastTrafficAt,
      lastHeartbeatAt,
      lastHeartbeat,
      warnings,
    });
  };

  socket.on('message', (msg: Buffer) => {
    decodeFrames(new Uint8Array(msg), (frame) => {
      lastFrameAt = Date.now();
      const heartbeat = parseHeartbeat(frame);
      if (heartbeat) {
        lastHeartbeatAt = heartbeat.updatedAt;
        lastHeartbeat = heartbeat;
      }
      const ownship = parseOwnship(frame);
      if (ownship && onOwnship) {
        lastOwnshipAt = ownship.updatedAt;
        onOwnship(ownship);
      }
      const traffic = parseTraffic(frame);
      if (traffic) {
        lastTrafficAt = traffic.updatedAt;
        onTraffic(traffic);
      }
      emitHealth();
    });
  });

  socket.on('error', (err: unknown) => {
    if (onError) onError(err);
  });

  const start = () => {
    try {
      socket.bind(port);
      healthTimer = setInterval(() => {
        emitHealth();
      }, 1000);
      emitHealth();
    } catch (err) {
      if (onError) onError(err);
    }
  };

  const stop = () => {
    if (healthTimer) {
      clearInterval(healthTimer);
      healthTimer = null;
    }
    try {
      socket.close();
    } catch {
      // ignore
    }
  };

  return { start, stop };
}
