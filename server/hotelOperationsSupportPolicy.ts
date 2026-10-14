export const HOTEL_OPS_SUPPORT_STATUSES = ["waiting", "active", "pending", "resolved"] as const;

export function effectiveSupportPresence(input: { enabled: boolean; presenceStatus: string; lastHeartbeatAt: Date | null }, now = new Date()) {
  if (!input.enabled || input.presenceStatus === "offline" || !input.lastHeartbeatAt) return "offline";
  if (input.presenceStatus === "away") return "away";
  return now.getTime() - input.lastHeartbeatAt.getTime() <= 90_000 ? "online" : "offline";
}

export function shouldEscalateFirstResponse(input: { type: string; firstHumanResponseAt: Date | null; deadlineAt: Date | null }, now = new Date()) {
  return input.type === "live_chat" && !input.firstHumanResponseAt && !!input.deadlineAt && input.deadlineAt.getTime() <= now.getTime();
}

export function canTransitionSupportStatus(from: string, to: string) {
  const transitions: Record<string, string[]> = {
    waiting: ["active", "pending", "resolved"], active: ["pending", "resolved"],
    pending: ["active", "resolved"], resolved: ["active"],
  };
  return transitions[from]?.includes(to) || false;
}

export function dedupeSupportRecipients(emails: readonly string[]) {
  return Array.from(new Set(emails.map((value) => value.trim().toLowerCase()).filter(Boolean)));
}

export function supportRetryDelayMs(attempt: number) {
  return Math.min(15 * 60_000, 30_000 * Math.max(1, 2 ** Math.max(0, attempt - 1)));
}
