import { describe, it, expect } from "vitest";
import { clubPeriodKeepsPro, freeTrialLengthLabel } from "./clubTrial";

describe("clubPeriodKeepsPro", () => {
  it("does not count Club that was never held", () => {
    expect(clubPeriodKeepsPro(undefined)).toBe(false);
  });

  it("does not count a free trial, so cancelling one does not leave Pro behind", () => {
    expect(clubPeriodKeepsPro("TRIAL")).toBe(false);
    expect(clubPeriodKeepsPro("trial")).toBe(false);
  });

  it.each(["NORMAL", "INTRO", "PREPAID", "normal"])(
    "counts a paid period (%s)",
    (periodType) => {
      expect(clubPeriodKeepsPro(periodType)).toBe(true);
    },
  );
});

describe("freeTrialLengthLabel", () => {
  it("says days in days", () => {
    expect(freeTrialLengthLabel("DAY", 14)).toBe("14 days");
    expect(freeTrialLengthLabel("DAY", 1)).toBe("1 day");
  });

  it("says weeks in days, so a fortnight matches a 14-day trial", () => {
    expect(freeTrialLengthLabel("WEEK", 2)).toBe("14 days");
    expect(freeTrialLengthLabel("week", 1)).toBe("7 days");
  });

  it("says months and years as they are", () => {
    expect(freeTrialLengthLabel("MONTH", 1)).toBe("1 month");
    expect(freeTrialLengthLabel("MONTH", 3)).toBe("3 months");
    expect(freeTrialLengthLabel("YEAR", 1)).toBe("1 year");
  });

  it("says nothing rather than guess", () => {
    expect(freeTrialLengthLabel("UNKNOWN", 2)).toBeNull();
    expect(freeTrialLengthLabel("DAY", 0)).toBeNull();
    expect(freeTrialLengthLabel("DAY", 1.5)).toBeNull();
  });
});
