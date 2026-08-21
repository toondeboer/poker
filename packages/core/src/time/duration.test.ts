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
    expect(clampRoundDuration(0)).toBe(MIN_ROUND_DURATION_SECONDS);
    expect(clampRoundDuration(999_999)).toBe(MAX_ROUND_DURATION_SECONDS);
    expect(clampRoundDuration(600.4)).toBe(600);
  });
  // Regression: the floor used to be 10 seconds, so a host typing 5 got 10 back
  // with nothing said about it, which reads as a broken field rather than a rule.
  it("keeps a short round exactly as entered", () => {
    expect(clampRoundDuration(5)).toBe(5);
    expect(clampRoundDuration(1)).toBe(1);
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
    expect(joinDuration(0, 0)).toBe(MIN_ROUND_DURATION_SECONDS);
    expect(joinDuration(999, 0)).toBe(MAX_ROUND_DURATION_SECONDS);
  });
  it("passes a few-second round straight through", () => {
    expect(joinDuration(0, 5)).toBe(5);
  });
  it("round-trips with splitDuration", () => {
    const { minutes, seconds } = splitDuration(610);
    expect(joinDuration(minutes, seconds)).toBe(610);
  });
});
