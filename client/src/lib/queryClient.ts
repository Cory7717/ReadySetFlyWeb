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
      try {
        const payload = JSON.parse(text);
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
        throw new Error(message || res.statusText);
      } catch {
        // Fall through to raw text handling if JSON parsing fails.
      }
    }

    throw new Error(text);
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
