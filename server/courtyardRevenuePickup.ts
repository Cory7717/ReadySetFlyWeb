export const SUBSTANTIAL_ROOM_PICKUP_THRESHOLD = 7;

export function substantialRoomPickup(roomDelta: unknown): boolean {
  return typeof roomDelta === "number" && Number.isFinite(roomDelta) && roomDelta > SUBSTANTIAL_ROOM_PICKUP_THRESHOLD;
}

export function pickupWatchDates<T extends { comparable?: boolean; roomDelta?: number }>(rows: T[]): T[] {
  return rows.filter((row) => row.comparable && substantialRoomPickup(row.roomDelta))
    .sort((a, b) => (b.roomDelta ?? 0) - (a.roomDelta ?? 0));
}
