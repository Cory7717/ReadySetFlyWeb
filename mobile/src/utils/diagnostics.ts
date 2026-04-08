import axios from 'axios';

const ENABLE_DIAGNOSTICS = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS === 'true';

type DiagnosticLevel = 'log' | 'warn' | 'error';

function emit(level: DiagnosticLevel, scope: string, message: string, details?: unknown) {
  if (!ENABLE_DIAGNOSTICS) return;
  const prefix = `[RSF:${scope}] ${message}`;
  if (details === undefined) {
    console[level](prefix);
    return;
  }
  console[level](prefix, details);
}

export function diagnosticsEnabled() {
  return ENABLE_DIAGNOSTICS;
}

export function logDiagnostic(scope: string, message: string, details?: unknown) {
  emit('log', scope, message, details);
}

export function warnDiagnostic(scope: string, message: string, details?: unknown) {
  emit('warn', scope, message, details);
}

export function errorDiagnostic(scope: string, message: string, details?: unknown) {
  emit('error', scope, message, details);
}

export function extractApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as
      | {
          error?: unknown;
          message?: unknown;
          details?: unknown;
        }
      | undefined;

    if (typeof payload?.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
    if (typeof payload?.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }

    const detailLines = flattenErrorDetails(payload?.details ?? payload?.error);
    if (detailLines.length > 0) {
      return detailLines.join('\n');
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function flattenErrorDetails(value: unknown, prefix = ''): string[] {
  if (!value) return [];
  if (typeof value === 'string') {
    return value.trim() ? [`${prefix}${value}`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenErrorDetails(item, prefix));
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
      flattenErrorDetails(nested, prefix ? `${prefix}${key}.` : `${key}: `)
    );
  }
  return [];
}
