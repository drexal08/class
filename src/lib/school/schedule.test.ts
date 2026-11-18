import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findOverlaps,
  formatTime,
  formatTimeRange,
  groupByWeekday,
  hasSlotEnded,
  isValidTime,
  minutesSinceMidnight,
  minutesToTime,
  slotsForToday,
  slotsOverlap,
  sortSlots,
  timeToMinutes,
  todayKey,
  todayWeekday,
  validateSlot,
  weekdayOf,
} from "./schedule";

describe("time parsing", () => {
  it("converts between wall-clock times and minutes", () => {
    assert.equal(timeToMinutes("08:30"), 510);
    assert.equal(timeToMinutes("00:00"), 0);
    assert.equal(timeToMinutes("23:59"), 1439);
    assert.equal(minutesToTime(510), "08:30");
  });

  it("rejects malformed times", () => {
    assert.equal(isValidTime("8:30"), false);
    assert.equal(isValidTime("24:00"), false);
    assert.equal(isValidTime("12:60"), false);
    assert.equal(timeToMinutes("nope"), null);
  });

  it("formats readable ranges", () => {
    assert.equal(formatTime("08:00"), "8:00 AM");
    assert.equal(formatTime("12:00"), "12:00 PM");
    assert.equal(formatTime("13:05"), "1:05 PM");
    assert.equal(formatTimeRange("08:00", "09:30"), "8:00 AM – 9:30 AM");
  });
});

describe("validateSlot", () => {
  it("accepts a well formed slot", () => {
    assert.equal(validateSlot({ weekday: 0, startsAt: "08:00", endsAt: "09:00" }), null);
  });

  it("rejects an end at or before the start", () => {
    assert.match(
      validateSlot({ weekday: 0, startsAt: "09:00", endsAt: "09:00" }) ?? "",
      /after the start/,
    );
    assert.match(
      validateSlot({ weekday: 0, startsAt: "10:00", endsAt: "09:00" }) ?? "",
      /after the start/,
    );
  });

  it("rejects an invalid weekday", () => {
    assert.ok(validateSlot({ weekday: 7, startsAt: "08:00", endsAt: "09:00" }));
  });
});

describe("overlap detection", () => {
  it("treats back-to-back slots as compatible", () => {
    assert.equal(
      slotsOverlap(
        { weekday: 1, startsAt: "08:00", endsAt: "09:00" },
        { weekday: 1, startsAt: "09:00", endsAt: "10:00" },
      ),
      false,
    );
  });

  it("detects a partial overlap on the same day", () => {
    assert.equal(
      slotsOverlap(
        { weekday: 1, startsAt: "08:00", endsAt: "09:30" },
        { weekday: 1, startsAt: "09:00", endsAt: "10:00" },
      ),
      true,
    );
  });

  it("never compares different weekdays", () => {
    assert.equal(
      slotsOverlap(
        { weekday: 1, startsAt: "08:00", endsAt: "10:00" },
        { weekday: 2, startsAt: "08:00", endsAt: "10:00" },
      ),
      false,
    );
  });

  it("lists every conflicting pair", () => {
    const pairs = findOverlaps([
      { weekday: 0, startsAt: "08:00", endsAt: "09:00" },
      { weekday: 0, startsAt: "08:30", endsAt: "09:30" },
      { weekday: 0, startsAt: "10:00", endsAt: "11:00" },
    ]);

    assert.equal(pairs.length, 1);
  });
});

describe("sorting and grouping", () => {
  it("sorts by weekday then start time", () => {
    const sorted = sortSlots([
      { weekday: 2, startsAt: "09:00" },
      { weekday: 0, startsAt: "11:00" },
      { weekday: 0, startsAt: "08:00" },
    ]);

    assert.deepEqual(
      sorted.map((slot) => `${slot.weekday}:${slot.startsAt}`),
      ["0:08:00", "0:11:00", "2:09:00"],
    );
  });

  it("groups into all seven days, including empty ones", () => {
    const groups = groupByWeekday([
      { weekday: 0, startsAt: "08:00" },
      { weekday: 4, startsAt: "13:00" },
    ]);

    assert.equal(groups.length, 7);
    assert.equal(groups[0].label, "Monday");
    assert.equal(groups[0].slots.length, 1);
    assert.equal(groups[1].slots.length, 0);
    assert.equal(groups[4].slots.length, 1);
  });
});

describe("school-local today", () => {
  it("resolves the date in the school's timezone, not the viewer's", () => {
    // 2026-11-18 00:30 UTC is already 02:30 in Kigali (UTC+2).
    const instant = new Date(Date.UTC(2026, 10, 18, 0, 30));
    assert.equal(todayKey(instant, "Africa/Kigali"), "2026-11-18");

    // 2026-11-17 23:30 UTC is still 17 November in London but the 18th in Kigali.
    const late = new Date(Date.UTC(2026, 10, 17, 23, 30));
    assert.equal(todayKey(late, "Africa/Kigali"), "2026-11-18");
    assert.equal(todayKey(late, "Europe/London"), "2026-11-17");
  });

  it("maps a date to a Monday-first weekday", () => {
    assert.equal(weekdayOf("2026-11-16"), 0); // Monday
    assert.equal(weekdayOf("2026-11-22"), 6); // Sunday
  });

  it("returns Wednesday's slots for a Wednesday in Kigali", () => {
    const now = new Date(Date.UTC(2026, 10, 18, 7, 0)); // 09:00 Kigali, Wednesday
    assert.equal(todayWeekday(now, "Africa/Kigali"), 2);

    const todays = slotsForToday(
      [
        { weekday: 1, startsAt: "11:00" },
        { weekday: 2, startsAt: "09:00" },
        { weekday: 2, startsAt: "08:00" },
      ],
      now,
      "Africa/Kigali",
    );

    assert.deepEqual(
      todays.map((slot) => slot.startsAt),
      ["08:00", "09:00"],
    );
  });

  it("computes minutes since midnight in the school's timezone", () => {
    const now = new Date(Date.UTC(2026, 10, 18, 7, 45));
    assert.equal(minutesSinceMidnight(now, "Africa/Kigali"), 9 * 60 + 45);
  });
});

describe("hasSlotEnded", () => {
  it("is true only once the end time has passed", () => {
    assert.equal(hasSlotEnded({ endsAt: "09:00" }, 8 * 60 + 59), false);
    assert.equal(hasSlotEnded({ endsAt: "09:00" }, 9 * 60), true);
  });
});
