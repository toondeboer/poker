import { describe, it, expect } from "vitest";
import { calculateTimeLeft, computeEndTime, progress } from "./timerMath";

describe("calculateTimeLeft", () => {
  it("returns whole seconds remaining, rounded up", () => {
    expect(calculateTimeLeft(10_000, 0)).toBe(10);
    expect(calculateTimeLeft(1_500, 0)).toBe(2);
  });

  it("never returns a negative value", () => {
    expect(calculateTimeLeft(0, 10_000)).toBe(0);
  });
});

describe("computeEndTime", () => {
  it("is the inverse of calculateTimeLeft", () => {
    const now = 1_000_000;
    const end = computeEndTime(30, now);
    expect(end).toBe(now + 30_000);
    expect(calculateTimeLeft(end, now)).toBe(30);
  });
});

describe("progress", () => {
  it("reports the fraction elapsed (not remaining)", () => {
    expect(progress(600, 600)).toBe(0);
    expect(progress(300, 600)).toBe(0.5);
    expect(progress(0, 600)).toBe(1);
  });

  it("clamps to [0, 1]", () => {
    expect(progress(700, 600)).toBe(0); // more time left than the round length
    expect(progress(-10, 600)).toBe(1); // overrun past zero
  });

  it("returns 0 for a non-positive duration", () => {
    expect(progress(100, 0)).toBe(0);
  });
});
