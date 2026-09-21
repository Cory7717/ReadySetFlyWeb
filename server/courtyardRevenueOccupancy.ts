// Courtyard Austin Northwest/Lakeline room inventory. Monthly OTB occupancy is
// sold room-nights divided by all available room-nights in the target month.
export const COURTYARD_ROOM_INVENTORY = 118;

export function daysInTargetMonth(targetMonth: string): number {
  const year = Number(targetMonth.slice(0, 4));
  const month = Number(targetMonth.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthlyOtbOccupancy(roomsOtb: number | null, targetMonth: string): number | null {
  if (roomsOtb == null || !Number.isFinite(roomsOtb)) return null;
  return roomsOtb / (COURTYARD_ROOM_INVENTORY * daysInTargetMonth(targetMonth));
}

export function effectiveSnapshotOccupancy(snapshot: {
  detailAvailable: boolean;
  targetMonth: string;
  roomsOtb: number | null;
  occupancy: string | number | null;
}): string | number | null {
  return snapshot.detailAvailable
    ? monthlyOtbOccupancy(snapshot.roomsOtb, snapshot.targetMonth)
    : snapshot.occupancy;
}
