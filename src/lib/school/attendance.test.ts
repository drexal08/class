import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attendanceRate,
  buildMonthMatrix,
  bucketStatusesByDay,
  isValidDateKey,
  parseDateKey,
  summariseAttendance,
  summariseDay,
  toDateKey,
} from "./attendance";

describe("attendanceRate", () => {
  it("counts late as attendance", () => {
    assert.equal(attendanceRate(["PRESENT", "LATE", "ABSENT"]), 66.7);
  });

  it("excludes excused absences from both sides", () => {
    // One present, one excused: 1/1, not 1/2.
    assert.equal(attendanceRate(["PRESENT", "EXCUSED"]), 100);
  });

  it("counts leaving early against the rate", () => {
    assert.equal(attendanceRate(["PRESENT", "LEFT_EARLY"]), 50);
  });

  it("returns null when every session was excused", () => {
    assert.equal(attendanceRate(["EXCUSED", "EXCUSED"]), null);
  });

  it("returns null when there are no records at all", () => {
    assert.equal(attendanceRate([]), null);
  });

  it("rounds to one decimal place", () => {
    // 2 of 3 = 66.666…%
    assert.equal(attendanceRate(["PRESENT", "PRESENT", "ABSENT"]), 66.7);
  });
});

describe("summariseAttendance", () => {
  it("separates attended from counted", () => {
    const counts = summariseAttendance([
      "PRESENT",
      "LATE",
      "ABSENT",
      "EXCUSED",
      "LEFT_EARLY",
    ]);

    assert.deepEqual(counts, {
      present: 1,
      late: 1,
      absent: 1,
      excused: 1,
      leftEarly: 1,
      attended: 2,
      counted: 4,
    });
  });

  it("returns zeroes for an empty list", () => {
    assert.deepEqual(summariseAttendance([]), {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      leftEarly: 0,
      attended: 0,
      counted: 0,
    });
  });
});

describe("date keys", () => {
  it("formats a UTC date as a stable day key", () => {
    assert.equal(toDateKey(new Date(Date.UTC(2026, 10, 18, 0, 0, 0))), "2026-11-18");
  });

  it("round-trips a key through parseDateKey", () => {
    assert.equal(toDateKey(parseDateKey("2026-02-28")), "2026-02-28");
  });

  it("rejects a key that is not a real calendar day", () => {
    assert.equal(isValidDateKey("2026-02-30"), false);
    assert.equal(isValidDateKey("2026-2-3"), false);
    assert.equal(isValidDateKey("2026-02-28"), true);
  });
});

describe("buildMonthMatrix", () => {
  it("starts weeks on Monday and pads the first row", () => {
    // 1 November 2026 is a Sunday, so the first row holds the last days of
    // October and the 1st at the end.
    const matrix = buildMonthMatrix(2026, 11);

    // Six leading days plus thirty days in the month fills exactly six weeks.
    assert.equal(matrix.weeks.length, 6);
    for (const week of matrix.weeks) {
      assert.equal(week.length, 7);
    }

    const firstWeek = matrix.weeks[0];
    assert.equal(firstWeek[0].key, "2026-10-26");
    assert.equal(firstWeek[6].key, "2026-11-01");
    assert.equal(firstWeek[6].inMonth, true);
  });

  it("leaves days without records empty rather than marking them absent", () => {
    const matrix = buildMonthMatrix(2026, 11);
    const cell = matrix.weeks[2][0];

    assert.deepEqual(cell.statuses, []);
    assert.equal(summariseDay(cell.statuses), null);
  });

  it("attaches recorded statuses to the correct day", () => {
    const byDay = bucketStatusesByDay([
      { date: parseDateKey("2026-11-18"), status: "LATE" },
      { date: parseDateKey("2026-11-18"), status: "PRESENT" },
      { date: parseDateKey("2026-11-19"), status: "EXCUSED" },
    ]);

    const matrix = buildMonthMatrix(2026, 11, byDay);
    const flat = matrix.weeks.flat();
    const eighteenth = flat.find((cell) => cell.key === "2026-11-18");
    const nineteenth = flat.find((cell) => cell.key === "2026-11-19");

    assert.deepEqual(eighteenth?.statuses, ["LATE", "PRESENT"]);
    assert.deepEqual(nineteenth?.statuses, ["EXCUSED"]);
    assert.equal(summariseDay(eighteenth?.statuses ?? []), "LATE");
  });
});
