function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTimeInput(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateTimeInput(date: Date) {
  return `${formatDateInput(date)} ${formatTimeInput(date)}`;
}

export function parseDateInput(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!year || !month || !day) return null;
  const candidate = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return candidate;
}

export function parseDateTimeInput(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim().replace('T', ' ');
  const match = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/.exec(normalized);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if ([year, month, day, hour, minute].some((part) => Number.isNaN(part))) {
    return null;
  }
  const candidate = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day ||
    candidate.getHours() !== hour ||
    candidate.getMinutes() !== minute
  ) {
    return null;
  }
  return candidate;
}

export function mergeDatePart(currentValue: string, nextDate: Date, fallback?: Date) {
  const base = parseDateTimeInput(currentValue) || fallback || new Date();
  const merged = new Date(base);
  merged.setFullYear(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
  return formatDateTimeInput(merged);
}

export function mergeTimePart(currentValue: string, nextTime: Date, fallback?: Date) {
  const base = parseDateTimeInput(currentValue) || fallback || new Date();
  const merged = new Date(base);
  merged.setHours(nextTime.getHours(), nextTime.getMinutes(), 0, 0);
  return formatDateTimeInput(merged);
}
