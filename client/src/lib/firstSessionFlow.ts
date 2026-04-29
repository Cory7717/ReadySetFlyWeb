export type ResumeFlowType = "listing" | "verification" | "logbook";

export type ResumeFlowRecord = {
  type: ResumeFlowType;
  title: string;
  description: string;
  target: string;
  updatedAt: number;
  payload?: Record<string, unknown>;
};

const RESUME_FLOW_STORAGE_KEY = "rsf.first_session.resume_flows";

function readFlowMap(): Partial<Record<ResumeFlowType, ResumeFlowRecord>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RESUME_FLOW_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Partial<Record<ResumeFlowType, ResumeFlowRecord>>;
  } catch {
    return {};
  }
}

function writeFlowMap(flowMap: Partial<Record<ResumeFlowType, ResumeFlowRecord>>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RESUME_FLOW_STORAGE_KEY, JSON.stringify(flowMap));
  } catch {}
}

export function saveResumeFlow(record: ResumeFlowRecord) {
  const flowMap = readFlowMap();
  flowMap[record.type] = record;
  writeFlowMap(flowMap);
}

export function clearResumeFlow(type: ResumeFlowType) {
  const flowMap = readFlowMap();
  delete flowMap[type];
  writeFlowMap(flowMap);
}

export function getResumeFlows(): ResumeFlowRecord[] {
  const flowMap = readFlowMap();
  return Object.values(flowMap)
    .filter((record): record is ResumeFlowRecord => Boolean(record))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getPrimaryResumeFlow(): ResumeFlowRecord | null {
  return getResumeFlows()[0] || null;
}
