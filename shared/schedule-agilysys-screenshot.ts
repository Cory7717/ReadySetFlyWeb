import { z } from "zod";

export const agilysysScreenshotSchema = z.object({
  days: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    columnIndex: z.coerce.number().int().min(0).max(30).optional(),
    arriving: z.coerce.number().int().min(0).max(10000),
    departing: z.coerce.number().int().min(0).max(10000),
    stayover: z.coerce.number().int().min(0).max(10000),
    roomsSold: z.coerce.number().int().min(0).max(10000),
    outOfOrderRooms: z.coerce.number().int().min(0).max(10000).default(0),
  })).min(1).max(31),
});

const agilysysScreenshotColumnSchema = z.object({
  days: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    columnIndex: z.coerce.number().int().min(0).max(30).optional(),
    arriving: z.coerce.number().int().min(0).max(10000),
    departing: z.coerce.number().int().min(0).max(10000),
    stayover: z.coerce.number().int().min(0).max(10000),
    roomsSold: z.coerce.number().int().min(0).max(10000),
    outOfOrderRooms: z.coerce.number().int().min(0).max(10000).default(0),
  })).min(1).max(31),
});

export function normalizeAgilysysScreenshotDays(parsedJson: unknown, scheduleDays: string[]) {
  const dated = agilysysScreenshotSchema.safeParse(parsedJson);
  if (dated.success) return dated.data.days;

  const columnMapped = agilysysScreenshotColumnSchema.safeParse(parsedJson);
  if (!columnMapped.success) throw new Error("The screenshot could not be read as an Agilysys forecast grid.");

  return columnMapped.data.days.map((day) => {
    const scheduleDate = typeof day.columnIndex === "number" ? scheduleDays[day.columnIndex] : null;
    const date = day.date || scheduleDate;
    if (!date) return null;
    return {
      date,
      arriving: day.arriving,
      departing: day.departing,
      stayover: day.stayover,
      roomsSold: day.roomsSold,
      outOfOrderRooms: day.outOfOrderRooms,
    };
  }).filter((day): day is NonNullable<typeof day> => Boolean(day));
}
