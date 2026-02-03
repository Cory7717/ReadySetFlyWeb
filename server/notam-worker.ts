import crypto from "crypto";
import stompit from "stompit";
import { XMLParser } from "fast-xml-parser";
import { db } from "./db";
import { notams as notamsTable } from "@shared/schema";

type NormalizedNotam = {
  icao: string;
  notamId: string;
  text: string;
  effectiveAt?: Date | null;
  expiresAt?: Date | null;
  raw?: any;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: true,
  trimValues: true,
});

function parseNotamDate(raw?: string | null) {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!/^\d{10}$/.test(cleaned)) return null;
  const year = 2000 + Number(cleaned.slice(0, 2));
  const month = Number(cleaned.slice(2, 4)) - 1;
  const day = Number(cleaned.slice(4, 6));
  const hour = Number(cleaned.slice(6, 8));
  const minute = Number(cleaned.slice(8, 10));
  return new Date(Date.UTC(year, month, day, hour, minute));
}

function extractFromText(text: string): Partial<NormalizedNotam> {
  const icaoMatch = text.match(/\bA\)\s*([A-Z]{3,4})/);
  const effMatch = text.match(/\bB\)\s*([0-9]{10})/);
  const expMatch = text.match(/\bC\)\s*([0-9]{10})/);
  const idMatch = text.match(/\b([A-Z]{3,4}\s\d{2}\/\d{3})\b/);

  return {
    icao: icaoMatch?.[1]?.toUpperCase(),
    notamId: idMatch?.[1]?.replace(/\s+/g, " "),
    effectiveAt: parseNotamDate(effMatch?.[1]),
    expiresAt: parseNotamDate(expMatch?.[1]),
  };
}

function stableNotamId(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 24);
}

function normalizeNotamItem(item: any): NormalizedNotam | null {
  const text =
    item?.text ||
    item?.notamText ||
    item?.rawText ||
    item?.message ||
    item?.body ||
    (typeof item === "string" ? item : null);
  if (!text) return null;

  const extracted = extractFromText(text);
  const notamId = item?.notamId || item?.id || extracted.notamId || stableNotamId(text);
  const icao = (item?.icao || item?.location || extracted.icao || "").toUpperCase();
  if (!icao) return null;

  return {
    icao,
    notamId: String(notamId),
    text: String(text),
    effectiveAt: extracted.effectiveAt,
    expiresAt: extracted.expiresAt,
    raw: item,
  };
}

function normalizePayload(payload: any): NormalizedNotam[] {
  if (!payload) return [];
  const list =
    payload?.notams ||
    payload?.notamList ||
    payload?.NOTAMs ||
    payload?.data ||
    payload?.items ||
    payload?.results ||
    payload?.notam ||
    payload?.NOTAM ||
    payload;

  if (Array.isArray(list)) {
    return list.map(normalizeNotamItem).filter(Boolean) as NormalizedNotam[];
  }

  const single = normalizeNotamItem(list);
  return single ? [single] : [];
}

async function upsertNotams(items: NormalizedNotam[]) {
  if (items.length === 0) return;
  for (const item of items) {
    await db
      .insert(notamsTable)
      .values({
        icao: item.icao,
        notamId: item.notamId,
        text: item.text,
        effectiveAt: item.effectiveAt ?? null,
        expiresAt: item.expiresAt ?? null,
        source: "swim",
        raw: item.raw ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: notamsTable.notamId,
        set: {
          icao: item.icao,
          text: item.text,
          effectiveAt: item.effectiveAt ?? null,
          expiresAt: item.expiresAt ?? null,
          raw: item.raw ?? null,
          updatedAt: new Date(),
        },
      });
  }
}

function parsePayload(body: string) {
  try {
    return JSON.parse(body);
  } catch {
    // fall through
  }
  try {
    return parser.parse(body);
  } catch {
    return body;
  }
}

export function startSwimNotamWorker() {
  const queueName = process.env.SWIM_JMS_QUEUE;
  const username = process.env.SWIM_JMS_USERNAME;
  const password = process.env.SWIM_JMS_PASSWORD;
  const connectionUrl = process.env.SWIM_STOMP_URL || process.env.SWIM_JMS_URL;
  const connectionFactory = process.env.SWIM_JMS_CONNECTION_FACTORY;
  const vpn = process.env.SWIM_JMS_VPN;
  const hostHeader = process.env.SWIM_STOMP_HOST || vpn;
  const clientId = process.env.SWIM_STOMP_CLIENT_ID || connectionFactory || username;
  const allowInsecure = String(process.env.SWIM_TLS_INSECURE ?? "").toLowerCase() === "true";
  const acceptVersion = process.env.SWIM_STOMP_ACCEPT_VERSION || "1.1,1.0";
  const forceLoginWithVpn = String(process.env.SWIM_STOMP_LOGIN_WITH_VPN ?? "").toLowerCase() === "true";

  if (!queueName || !username || !password || !connectionUrl || !vpn) {
    console.warn("SWIM JMS env vars missing. NOTAM worker will not start.");
    return false;
  }

  const destination =
    process.env.SWIM_STOMP_DESTINATION ||
    (process.env.SWIM_QUEUE_PREFIX ? `${process.env.SWIM_QUEUE_PREFIX}${queueName}` : queueName);

  const url = new URL(connectionUrl);
  if (url.protocol === "ws:" || url.protocol === "wss:") {
    console.error("SWIM STOMP URL must be a TCP/TLS endpoint (ws/wss not supported).");
    return false;
  }

  const baseOptions: Omit<stompit.ConnectOptions, "connectHeaders"> = {
    host: url.hostname,
    port: Number(url.port) || 55443,
    ssl: url.protocol === "tcps:" || url.protocol === "ssl:" || url.protocol === "tls:" || url.protocol === "stomp+ssl:" || url.protocol === "stomp+tls:",
    sslOptions: {
      servername: url.hostname,
      rejectUnauthorized: !allowInsecure,
    },
  };

  const profiles = forceLoginWithVpn
    ? [{ name: "login-with-vpn", login: `${username}@${vpn}` }]
    : [
        { name: "standard", login: username },
        { name: "login-with-vpn", login: `${username}@${vpn}` },
      ];

  let profileIndex = 0;
  let attempt = 0;

  const stompClient: any = (stompit as any)?.connect ? stompit : (stompit as any)?.default;
  if (!stompClient?.connect) {
    console.error("STOMP client missing connect(). Check stompit import.");
    return false;
  }

  const buildHeaders = (login: string): stompit.ConnectHeaders => {
    const headers: stompit.ConnectHeaders = {
      login,
      passcode: password,
      host: hostHeader,
      "accept-version": acceptVersion,
      "heart-beat": "10000,10000",
    };
    if (clientId) {
      headers["client-id"] = clientId;
    }
    return headers;
  };

  const scheduleReconnect = (reason: string) => {
    attempt += 1;
    profileIndex = (profileIndex + 1) % profiles.length;
    const backoff = Math.min(60000, 1000 * Math.pow(2, Math.min(attempt, 6)));
    const jitter = Math.floor(Math.random() * 500);
    console.warn(`SWIM STOMP reconnecting in ${backoff + jitter}ms (${reason}).`);
    setTimeout(start, backoff + jitter);
  };

  const start = () => {
    const profile = profiles[profileIndex];
    const connectOptions: stompit.ConnectOptions = {
      ...baseOptions,
      connectHeaders: buildHeaders(profile.login),
    };

    stompClient.connect(connectOptions, (error: any, client: any) => {
      if (error) {
        console.error("SWIM STOMP connect failed:", {
          message: error.message,
          code: error.code,
          name: error.name,
          profile: profile.name,
        });
        scheduleReconnect(error.message || "connect-error");
        return;
      }

      attempt = 0;

      console.log("SWIM STOMP connected. Listening on:", destination);

      const subscribeHeaders: stompit.SubscribeHeaders = {
        destination,
        ack: "client-individual",
      };

      client.subscribe(subscribeHeaders, (err, message) => {
        if (err) {
          console.error("SWIM subscribe error:", err.message);
          return;
        }

        message.readString("utf-8", async (readErr, body) => {
          if (readErr) {
            console.error("SWIM message read error:", readErr.message);
            client.ack(message);
            return;
          }

          try {
            const payload = parsePayload(body);
            const normalized = normalizePayload(payload);
            if (normalized.length === 0 && typeof payload === "string") {
              const fallback = normalizeNotamItem(payload);
              if (fallback) {
                normalized.push(fallback);
              }
            }
            await upsertNotams(normalized);
          } catch (ingestError: any) {
            console.error("NOTAM ingest error:", ingestError?.message || ingestError);
          } finally {
            client.ack(message);
          }
        });
      });

      client.on("error", (clientError) => {
        console.error("SWIM STOMP client error:", clientError?.message || clientError);
        try {
          client.disconnect();
        } catch {
          // ignore
        }
        scheduleReconnect(clientError?.message || "client-error");
      });
    });
  };
  start();
  return true;
}

const shouldAutoStart =
  process.env.SWIM_RUN_MODE === "worker" ||
  process.argv.some((arg) => arg.includes("notam-worker"));

if (shouldAutoStart) {
  startSwimNotamWorker();
}
