import { trackEvent } from "@/lib/analytics";

type AuthGateRequest = {
  actionName: string;
  fn: () => Promise<void>;
};

type AuthGateListener = (request: AuthGateRequest | null) => void;

const listeners = new Set<AuthGateListener>();
let pendingRequest: AuthGateRequest | null = null;
let isAuthenticated = false;
const ACTION_KEY = "rsf.auth_gate.action";

const notify = () => {
  listeners.forEach((listener) => listener(pendingRequest));
};

export const setAuthState = (next: boolean) => {
  isAuthenticated = next;
};

export const subscribeAuthGate = (listener: AuthGateListener) => {
  listeners.add(listener);
  listener(pendingRequest);
  return () => listeners.delete(listener);
};

export const runWithAuth = async (actionName: string, fn: () => Promise<void>) => {
  if (isAuthenticated) {
    await fn();
    return;
  }
  pendingRequest = { actionName, fn };
  try {
    window.sessionStorage.setItem(ACTION_KEY, actionName);
  } catch {}
  trackEvent("auth_gate_triggered", { action: actionName });
  notify();
};

export const clearAuthGate = () => {
  pendingRequest = null;
  try {
    window.sessionStorage.removeItem(ACTION_KEY);
  } catch {}
  notify();
};

export const completeAuthGate = async () => {
  if (!pendingRequest) return;
  const { actionName, fn } = pendingRequest;
  pendingRequest = null;
  try {
    window.sessionStorage.removeItem(ACTION_KEY);
  } catch {}
  trackEvent("auth_gate_completed", { action: actionName });
  notify();
  await fn();
};

export const cancelAuthGate = (actionName?: string) => {
  trackEvent("auth_gate_cancelled", { action: actionName });
  clearAuthGate();
};
