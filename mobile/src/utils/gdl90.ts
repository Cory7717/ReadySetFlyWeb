import { Buffer } from 'buffer';
import dgram from 'react-native-udp';

export type TrafficTarget = {
  id: string;
  lat: number;
  lon: number;
  altitudeFt?: number;
  callsign?: string;
  updatedAt: number;
};

type FrameHandler = (frame: Uint8Array) => void;

function signExtend24(value: number) {
  return value & 0x800000 ? value | 0xff000000 : value;
}

function semicirclesToDegrees(value: number) {
  return (value * 180) / 0x800000;
}

function parseLatLon(payload: Uint8Array) {
  if (payload.length < 7) return null;
  const latRaw = (payload[1] << 16) | (payload[2] << 8) | payload[3];
  const lonRaw = (payload[4] << 16) | (payload[5] << 8) | payload[6];
  const lat = semicirclesToDegrees(signExtend24(latRaw));
  const lon = semicirclesToDegrees(signExtend24(lonRaw));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
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

function parseTraffic(frame: Uint8Array): TrafficTarget | null {
  const msgId = frame[0];
  if (msgId !== 0x14 && msgId !== 0x0a) return null;

  const coords = parseLatLon(frame);
  if (!coords) return null;

  const callsign = frame.length > 18 ? parseCallsign(frame, 11, 8) : undefined;
  const altitudeFt = frame.length > 9 ? ((frame[7] << 4) | (frame[8] >> 4)) * 25 - 1000 : undefined;

  return {
    id: `${msgId}-${callsign || coords.lat.toFixed(4)}-${coords.lon.toFixed(4)}`,
    lat: coords.lat,
    lon: coords.lon,
    altitudeFt,
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

export function createGdl90Listener(port: number, onTraffic: (target: TrafficTarget) => void, onError?: (err: unknown) => void): Gdl90Listener {
  const socket = dgram.createSocket({ type: 'udp4', reusePort: true });

  socket.on('message', (msg: Buffer) => {
    decodeFrames(new Uint8Array(msg), (frame) => {
      const traffic = parseTraffic(frame);
      if (traffic) {
        onTraffic(traffic);
      }
    });
  });

  socket.on('error', (err: unknown) => {
    if (onError) onError(err);
  });

  const start = () => {
    try {
      socket.bind(port);
    } catch (err) {
      if (onError) onError(err);
    }
  };

  const stop = () => {
    try {
      socket.close();
    } catch {
      // ignore
    }
  };

  return { start, stop };
}
