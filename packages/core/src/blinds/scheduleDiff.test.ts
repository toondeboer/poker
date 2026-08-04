import { describe, it, expect } from "vitest";
import { blindLevelsEqual, describeScheduleChange } from "./scheduleDiff";
import type { BlindLevel } from "../types/BlindLevel";

const sample = (): BlindLevel[] => [
  { small: 5, big: 10 },
  { small: 10, big: 20 },
  { small: 15, big: 30 },
];

describe("blindLevelsEqual", () => {
  it("compares by value, not identity", () => {
    expect(blindLevelsEqual(sample(), sample())).toBe(true);
  });
  it("detects a value difference and a length difference", () => {
    const changed = sample();
    changed[1] = { small: 10, big: 25 };
    expect(blindLevelsEqual(sample(), changed)).toBe(false);
    expect(blindLevelsEqual(sample(), sample().slice(0, 2))).toBe(false);
  });
});

describe("describeScheduleChange", () => {
  it("reports no change for an identical draft", () => {
    expect(describeScheduleChange(sample(), sample(), 1)).toEqual({
      changed: false,
      nextIndex: 1,
      currentLevelDropped: false,
      currentLevelValuesChanged: false,
    });
  });

  it("keeps the index when a later level is edited", () => {
    const draft = sample();
    draft[2] = { small: 20, big: 40 };
    const result = describeScheduleChange(sample(), draft, 0);
    expect(result.changed).toBe(true);
    expect(result.nextIndex).toBe(0);
    expect(result.currentLevelDropped).toBe(false);
    expect(result.currentLevelValuesChanged).toBe(false);
  });

  it("flags a value change on the level being played", () => {
    const draft = sample();
    draft[1] = { small: 12, big: 24 };
    const result = describeScheduleChange(sample(), draft, 1);
    expect(result.currentLevelValuesChanged).toBe(true);
    expect(result.currentLevelDropped).toBe(false);
    expect(result.nextIndex).toBe(1);
  });

  it("flags the current level being dropped by a shorter draft", () => {
    const draft = sample().slice(0, 2);
    const result = describeScheduleChange(sample(), draft, 2);
    expect(result.changed).toBe(true);
    expect(result.currentLevelDropped).toBe(true);
    expect(result.nextIndex).toBe(1); // clamped to the new last level
  });

  it("leaves the index alone when the draft grows", () => {
    const draft = [...sample(), { small: 20, big: 40 }];
    const result = describeScheduleChange(sample(), draft, 2);
    expect(result.nextIndex).toBe(2);
    expect(result.currentLevelDropped).toBe(false);
  });
});
