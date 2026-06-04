import { describe, expect, it } from "vitest";
import { advanceTime, formatGameTime, setTimeOfDay } from "./time.service";

describe("game time progression", () => {
  it("jumps scene time-of-day labels to their canonical hours", () => {
    expect(setTimeOfDay({ day: 1, hour: 8, minute: 45 }, "night")).toEqual({
      day: 1,
      hour: 21,
      minute: 0,
    });
    expect(setTimeOfDay({ day: 1, hour: 23, minute: 10 }, "morning")).toEqual({
      day: 2,
      hour: 8,
      minute: 0,
    });
    expect(setTimeOfDay({ day: 1, hour: 21, minute: 30 }, "night")).toEqual({
      day: 1,
      hour: 21,
      minute: 30,
    });
    expect(setTimeOfDay({ day: 1, hour: 11, minute: 50 }, "noon")).toEqual({
      day: 1,
      hour: 12,
      minute: 0,
    });
    expect(formatGameTime({ day: 1, hour: 12, minute: 0 })).toBe("Day 1, 12:00 (noon)");
  });

  it("keeps action duration advancement separate from scene labels", () => {
    expect(advanceTime({ day: 1, hour: 8, minute: 45 }, "night")).toEqual({
      day: 1,
      hour: 9,
      minute: 0,
    });
  });
});
