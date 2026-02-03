import crypto from "crypto";
import { createRequire } from "module";
import { XMLParser } from "fast-xml-parser";
import { db } from "./db";
import { notams as notamsTable } from "@shared/schema";

const require = createRequire(import.meta.url);
const solclientModule = require("solclientjs");
const solclientjs = solclientModule?.debug || solclientModule;
let solaceInitialized = false;

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

function resolveSolaceLogLevel() {
  const raw = (process.env.SWIM_SOLACE_LOG_LEVEL || "WARN").toUpperCase();
  return solclientjs.LogLevel?.[raw] ?? solclientjs.LogLevel.WARN;
}

function initSolace() {
  if (solaceInitialized) return;
  solclientjs.SolclientFactory.init({
    profile: solclientjs.SolclientFactoryProfiles.version10,
    logLevel: resolveSolaceLogLevel(),
  });
  solaceInitialized = true;
}

function messageToString(message: any): string {
  if (!message) return "";
  try {
    const binary = message.getBinaryAttachment?.();
    if (binary) {
      if (typeof binary === "string") return binary;
      if (binary instanceof Uint8Array) {
        return Buffer.from(binary).toString("utf-8");
      }
      if (binary instanceof ArrayBuffer) {
        return Buffer.from(new Uint8Array(binary)).toString("utf-8");
      }
      if (Buffer.isBuffer(binary)) {
        return binary.toString("utf-8");
      }
    }
  } catch {
    // ignore
  }
  try {
    const text = message.getText?.();
    if (text) return text;
  } catch {
    // ignore
  }
  try {
    const xml = message.getXmlContent?.();
    if (xml) return xml;
  } catch {
    // ignore
  }
  return "";
}

export function startSwimNotamWorker() {
  const queueName = process.env.SWIM_JMS_QUEUE;
  const username = process.env.SWIM_JMS_USERNAME;
  const password = process.env.SWIM_JMS_PASSWORD;
  const connectionUrl = process.env.SWIM_JMS_URL;
  const vpn = process.env.SWIM_JMS_VPN;
  const allowInsecure = String(process.env.SWIM_TLS_INSECURE ?? "").toLowerCase() === "true";

  if (!queueName || !username || !password || !connectionUrl || !vpn) {
    console.warn("SWIM JMS env vars missing. NOTAM worker will not start.");
    return false;
  }

  initSolace();

  const sessionProps = {
    url: connectionUrl,
    vpnName: vpn,
    userName: username,
    password,
    connectRetries: 2,
    reconnectRetries: -1,
    reconnectRetryWaitInMsecs: 5000,
    keepAliveIntervalInMsecs: 10000,
    keepAliveIntervalsLimit: 3,
    sslValidateCertificate: !allowInsecure,
  };

  const session = solclientjs.SolclientFactory.createSession(sessionProps);
  let consumer: any = null;

  session.on(solclientjs.SessionEventCode.UP_NOTICE, () => {
    console.log("SWIM Solace session up. Subscribing to queue:", queueName);
    if (consumer) return;
    try {
      consumer = session.createMessageConsumer({
        queueDescriptor: { name: queueName, type: solclientjs.QueueType.QUEUE },
        acknowledgeMode: solclientjs.MessageConsumerAcknowledgeMode.CLIENT,
      });
    } catch (err: any) {
      console.error("SWIM consumer create failed:", err?.message || err);
      return;
    }

    consumer.on(solclientjs.MessageConsumerEventName.MESSAGE, async (message: any) => {
      try {
        const body = messageToString(message);
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
        try {
          message.acknowledge?.();
        } catch {
          // ignore
        }
      }
    });

    consumer.on(solclientjs.MessageConsumerEventName.CONNECT_FAILED_ERROR, (err: any) => {
      console.error("SWIM consumer connect failed:", err?.message || err);
    });

    consumer.on(solclientjs.MessageConsumerEventName.DOWN_ERROR, (err: any) => {
      console.error("SWIM consumer down:", err?.message || err);
    });

    consumer.connect();
  });

  session.on(solclientjs.SessionEventCode.CONNECT_FAILED_ERROR, (err: any) => {
    console.error("SWIM session connect failed:", err?.message || err);
  });

  session.on(solclientjs.SessionEventCode.DISCONNECTED, () => {
    console.warn("SWIM session disconnected.");
  });

  session.on(solclientjs.SessionEventCode.RECONNECTING, () => {
    console.warn("SWIM session reconnecting...");
  });

  session.connect();
  return true;
}

const shouldAutoStart =
  process.env.SWIM_RUN_MODE === "worker" ||
  process.argv.some((arg) => arg.includes("notam-worker"));

if (shouldAutoStart) {
  startSwimNotamWorker();
}
