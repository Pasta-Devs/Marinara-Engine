import { describe, expect, it } from "vitest";
import { getWorldTimeDisplay } from "./world-state-display";

describe("getWorldTimeDisplay", () => {
  it("keeps the PM suffix on spaced 12-hour times", () => {
    const result = getWorldTimeDisplay("6:00 PM");
    expect(result.suffix).toBe("PM");
    expect(result.main).toBe("06:00");
    expect(result.hour).toBe(18);
    expect(result.minute).toBe(0);
  });

  it("keeps the AM suffix on spaced 12-hour times", () => {
    const result = getWorldTimeDisplay("3:30 am");
    expect(result.suffix).toBe("AM");
    expect(result.main).toBe("03:30");
    expect(result.hour).toBe(3);
    expect(result.minute).toBe(30);
  });

  it("parses dotted meridiem markers", () => {
    const result = getWorldTimeDisplay("8:15 p.m.");
    expect(result.suffix).toBe("PM");
    expect(result.hour).toBe(20);
  });

  it("maps 12 AM to midnight and 12 PM to noon", () => {
    expect(getWorldTimeDisplay("12:00 AM").hour).toBe(0);
    expect(getWorldTimeDisplay("12:00 PM").hour).toBe(12);
  });

  it("still parses meridiem times without a space", () => {
    const result = getWorldTimeDisplay("6pm");
    expect(result.suffix).toBe("PM");
    expect(result.hour).toBe(18);
  });

  it("parses 24-hour times with no suffix", () => {
    const result = getWorldTimeDisplay("18:00");
    expect(result.suffix).toBe("");
    expect(result.main).toBe("18:00");
    expect(result.hour).toBe(18);
  });

  it("preserves the refactor-only h separator for 24-hour times", () => {
    const result = getWorldTimeDisplay("6h30");
    expect(result.suffix).toBe("");
    expect(result.main).toBe("06:30");
    expect(result.hour).toBe(6);
    expect(result.minute).toBe(30);
  });

  it("falls back to keyword hours", () => {
    const result = getWorldTimeDisplay("morning");
    expect(result.hour).toBe(9);
    expect(result.suffix).toBe("");
    expect(result.main).toBe("morning");
  });

  it("returns a placeholder for empty or missing input", () => {
    expect(getWorldTimeDisplay("").main).toBe("--:--");
    expect(getWorldTimeDisplay(null).hour).toBeNull();
    expect(getWorldTimeDisplay(undefined).hour).toBeNull();
  });
});
