export function requestEndDate(request: any): string {
  return request?.requestEndDate || request?.requestDate;
}

export function dateInRequestRange(request: any, dateKey: string): boolean {
  return dateKey >= request.requestDate && dateKey <= requestEndDate(request);
}

export function requestRangesOverlap(left: any, right: any): boolean {
  return left.requestDate <= requestEndDate(right) && requestEndDate(left) >= right.requestDate;
}

export function isExactDuplicateRequest(left: any, right: any): boolean {
  return left.requesterUserId === right.requesterUserId &&
    left.requestDate === right.requestDate &&
    requestEndDate(left) === requestEndDate(right) &&
    left.requestType === right.requestType &&
    String(left.startTime || "") === String(right.startTime || "") &&
    String(left.endTime || "") === String(right.endTime || "");
}

function minutesFromRequestTime(value?: string | null): number | null {
  const match = String(value || "").match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : null;
}

export function requestTimeWindowsOverlap(left: any, right: any): boolean {
  if ((!left.startTime && !left.endTime) || (!right.startTime && !right.endTime)) return true;
  if (!left.startTime || !left.endTime || !right.startTime || !right.endTime) return true;

  const expandWindow = (startTime: string, endTime: string) => {
    const start = minutesFromRequestTime(startTime);
    const end = minutesFromRequestTime(endTime);
    if (start == null || end == null || start === end) return [[0, 24 * 60]] as Array<[number, number]>;
    return end > start ? [[start, end]] as Array<[number, number]> : [[start, 24 * 60], [0, end]] as Array<[number, number]>;
  };

  const leftWindows = expandWindow(left.startTime, left.endTime);
  const rightWindows = expandWindow(right.startTime, right.endTime);
  return leftWindows.some(([leftStart, leftEnd]) =>
    rightWindows.some(([rightStart, rightEnd]) => leftStart < rightEnd && rightStart < leftEnd),
  );
}
