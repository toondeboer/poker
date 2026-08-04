import { describe, it, expect } from "vitest";
import {
  MAX_ROUND_DURATION_SECONDS,
  MIN_ROUND_DURATION_SECONDS,
  clampRoundDuration,
  joinDuration,
  splitDuration,
} from "./duration";

describe("clampRoundDuration", () => {
  it("clamps at both ends and rounds to whole seconds", () => {
    expect(clampRoundDuration(1)).toBe(MIN_ROUND_DURATION_SECONDS);
    expect(clampRoundDuration(999_999)).toBe(MAX_ROUND_DURATION_SECONDS);
    expect(clampRoundDuration(600.4)).toBe(600);
  });
  it("falls back to the minimum for non-finite input", () => {
    expect(clampRoundDuration(Number.NaN)).toBe(MIN_ROUND_DURATION_SECONDS);
  });
});

describe("splitDuration", () => {
  it("splits into minutes and seconds", () => {
    expect(splitDuration(610)).toEqual({ minutes: 10, seconds: 10 });
    expect(splitDuration(600)).toEqual({ minutes: 10, seconds: 0 });
    expect(splitDuration(45)).toEqual({ minutes: 0, seconds: 45 });
  });
  it("treats negative and non-finite input as zero", () => {
    expect(splitDuration(-5)).toEqual({ minutes: 0, seconds: 0 });
    expect(splitDuration(Number.NaN)).toEqual({ minutes: 0, seconds: 0 });
  });
});

describe("joinDuration", () => {
  it("recombines minutes and seconds", () => {
    expect(joinDuration(10, 10)).toBe(610);
    expect(joinDuration(12, 30)).toBe(750);
  });
  it("caps seconds at 59 rather than carrying into minutes", () => {
    expect(joinDuration(1, 90)).toBe(60 + 59);
  });
  it("clamps the result into the supported range", () => {
    expect(joinDuration(0, 1)).toBe(MIN_ROUND_DURATION_SECONDS);
    expect(joinDuration(999, 0)).toBe(MAX_ROUND_DURATION_SECONDS);
  });
  it("round-trips with splitDuration", () => {
    const { minutes, seconds } = splitDuration(610);
    expect(joinDuration(minutes, seconds)).toBe(610);
  });
});
