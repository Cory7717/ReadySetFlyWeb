import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAgilysysScreenshotDays } from "../../shared/schedule-agilysys-screenshot";

test("Agilysys screenshot parser maps column positions across month rollover", () => {
  const scheduleDays = [
    "2026-06-29",
    "2026-06-30",
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
    "2026-07-04",
    "2026-07-05",
  ];

  const normalized = normalizeAgilysysScreenshotDays({
    days: [
      { columnIndex: 0, arriving: 10, departing: 5, stayover: 90, roomsSold: 100, outOfOrderRooms: 0 },
      { columnIndex: 1, arriving: 11, departing: 6, stayover: 91, roomsSold: 102, outOfOrderRooms: 0 },
      { columnIndex: 2, arriving: 12, departing: 7, stayover: 92, roomsSold: 104, outOfOrderRooms: 0 },
      { columnIndex: 3, arriving: 13, departing: 8, stayover: 93, roomsSold: 106, outOfOrderRooms: 0 },
      { columnIndex: 4, arriving: 14, departing: 9, stayover: 94, roomsSold: 108, outOfOrderRooms: 0 },
    ],
  }, scheduleDays);

  assert.deepEqual(normalized.map((day) => day.date), [
    "2026-06-29",
    "2026-06-30",
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
  ]);
  assert.equal(normalized[2].roomsSold, 104);
});

test("Agilysys screenshot parser still accepts exact dated rows", () => {
  const normalized = normalizeAgilysysScreenshotDays({
    days: [
      { date: "2026-07-01", arriving: 12, departing: 7, stayover: 92, roomsSold: 104, outOfOrderRooms: 0 },
    ],
  }, ["2026-07-01"]);

  assert.equal(normalized[0].date, "2026-07-01");
  assert.equal(normalized[0].arriving, 12);
});
