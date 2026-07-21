import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiUrl } from "./api";

function collectValidationMessages(value: unknown, acc: string[] = []): string[] {
  if (!value) return acc;

  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized) acc.push(normalized);
    return acc;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectValidationMessages(item, acc));
    return acc;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record._errors)) {
      record._errors.forEach((item) => collectValidationMessages(item, acc));
    }
    Object.entries(record).forEach(([key, nested]) => {
      if (key === "_errors") return;
      collectValidationMessages(nested, acc);
    });
  }

  return acc;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      let payload: unknown = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }

      if (payload) {
        const validationMessages =
          payload && typeof payload === "object" && "validation" in payload
            ? collectValidationMessages((payload as Record<string, unknown>).validation)
            : [];
        const errorField =
          payload && typeof payload === "object" && "error" in payload
            ? (payload as Record<string, unknown>).error
            : null;
        const message = typeof errorField === "string" && errorField.trim()
          ? (validationMessages.length > 0
              ? `${errorField.trim()} ${validationMessages.join(" ")}`
              : errorField.trim())
            : validationMessages.length > 0
              ? validationMessages.join(" ")
              : JSON.stringify(payload);
        const error = new Error(message || res.statusText) as Error & {
          status?: number;
          code?: unknown;
          reason?: unknown;
          retryable?: unknown;
          operatorActionRequired?: unknown;
          validationMessages?: string[];
        };
        error.status = res.status;
        if (validationMessages.length > 0) {
          error.validationMessages = Array.from(new Set(validationMessages));
        }
        if (payload && typeof payload === "object") {
          const record = payload as Record<string, unknown>;
          error.code = record.code;
          error.reason = record.reason;
          error.retryable = record.retryable;
          error.operatorActionRequired = record.operatorActionRequired;
        }
        throw error;
      }
    }

    const error = new Error(text) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(apiUrl(url), {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(apiUrl(queryKey.join("/") as string), {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
