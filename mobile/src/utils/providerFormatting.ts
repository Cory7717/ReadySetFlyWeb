const USEFUL_ARTCC_FIELDS = ['facilityId', 'facility', 'center', 'name', 'state', 'status', 'message', 'phone', 'frequency'];

export function formatProviderName(value?: unknown) {
  const text = String(value || '').trim();
  if (!text) return 'FAA Flight Service';
  return text
    .replace(/leidos_flight_service/gi, 'FAA Flight Service')
    .replace(/Leidos Flight Service/g, 'FAA Flight Service')
    .replace(/Leidos/g, 'Flight Service')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatProviderValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return sanitizeProviderText(String(value));
  }
  if (Array.isArray(value)) {
    return value.map(formatProviderValue).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const parts = USEFUL_ARTCC_FIELDS
      .map((field) => formatProviderValue(record[field]))
      .filter(Boolean);
    return Array.from(new Set(parts)).join(' / ');
  }
  return '';
}

export function sanitizeProviderText(value: unknown): string {
  return String(value || '')
    .replace(/\[object Object\]/g, '')
    .replace(/leidos_flight_service/gi, 'FAA Flight Service')
    .replace(/Leidos Flight Service/g, 'FAA Flight Service')
    .replace(/Leidos/g, 'Flight Service')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatProviderMessage(message: unknown, fallback = ''): string {
  const formatted = formatProviderValue(message) || sanitizeProviderText(fallback);
  return formatted && formatted !== '[object Object]' ? formatted : '';
}

export function getFilingHistorySections(entry: any) {
  const summary = entry?.changeSummary && typeof entry.changeSummary === 'object' && !Array.isArray(entry.changeSummary)
    ? entry.changeSummary as Record<string, unknown>
    : {};
  const asLines = (value: unknown) =>
    (Array.isArray(value) ? value : [])
      .map((line) => sanitizeProviderText(line))
      .filter(Boolean);
  return [
    { title: 'Changes submitted', lines: asLines(summary.pilotChanges) },
    { title: 'RSF processing', lines: asLines(summary.rsfProcessingChanges) },
    { title: 'Flight Service', lines: asLines(summary.providerChanges) },
  ].filter((section) => section.lines.length > 0);
}

export function formatFilingActionLabel(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'flight_service' || normalized === 'provider_update' || normalized === 'webhook') return 'Flight Service';
  if (normalized === 'file') return 'File';
  if (normalized === 'amend') return 'Amend';
  if (normalized === 'activate') return 'Activate';
  if (normalized === 'cancel') return 'Cancel';
  if (normalized === 'close') return 'Close';
  return sanitizeProviderText(value) || 'History entry';
}
