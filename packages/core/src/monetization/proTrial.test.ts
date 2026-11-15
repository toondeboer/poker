import { describe, it, expect } from "vitest";
import { PRO_TRIAL_DAYS, proTrialState } from "./proTrial";

const DAY = 24 * 60 * 60 * 1000;
const START = 1_800_000_000_000;

describe("proTrialState", () => {
  it("is unused when no trial was ever started", () => {
    expect(proTrialState(null, START)).toEqual({ status: "unused" });
  });

  it("is active with the full length the moment it starts", () => {
    expect(proTrialState(START, START)).toEqual({
      status: "active",
      endsAt: START + PRO_TRIAL_DAYS * DAY,
      daysLeft: PRO_TRIAL_DAYS,
    });
  });

  it("counts down in whole days, rounding up", () => {
    expect(proTrialState(START, START + 1)).toMatchObject({
      daysLeft: PRO_TRIAL_DAYS,
    });
    expect(proTrialState(START, START + DAY)).toMatchObject({
      daysLeft: PRO_TRIAL_DAYS - 1,
    });
    expect(proTrialState(START, START + 5 * DAY + 1)).toMatchObject({
      daysLeft: PRO_TRIAL_DAYS - 5,
    });
  });

  it("says one day left through the final hours, never zero", () => {
    const state = proTrialState(START, START + PRO_TRIAL_DAYS * DAY - 1);
    expect(state).toMatchObject({ status: "active", daysLeft: 1 });
  });

  it("ends exactly when the last day does", () => {
    expect(proTrialState(START, START + PRO_TRIAL_DAYS * DAY)).toEqual({
      status: "ended",
      endedAt: START + PRO_TRIAL_DAYS * DAY,
    });
  });

  it("stays ended long afterwards, so it is never offered twice", () => {
    expect(proTrialState(START, START + 400 * DAY).status).toBe("ended");
  });

  it("treats a start date in the future as starting now", () => {
    const now = START;
    expect(proTrialState(now + 30 * DAY, now)).toEqual({
      status: "active",
      endsAt: now + PRO_TRIAL_DAYS * DAY,
      daysLeft: PRO_TRIAL_DAYS,
    });
  });
});
