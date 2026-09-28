import { describe, expect, it } from "vitest";
import { annualSavingPercent } from "./clubSaving";

describe("annualSavingPercent", () => {
  it("works out the saving at the prices actually charged", () => {
    // €2.99/month is €35.88 a year against a €19.99 annual.
    expect(annualSavingPercent(2.99, 19.99)).toBe(44);
  });

  it("is currency-agnostic, because it only ever sees numbers", () => {
    // The same ratio in a currency with no minor units at all.
    expect(annualSavingPercent(300, 1999)).toBe(44);
  });

  it("says nothing when the annual saves nothing", () => {
    expect(annualSavingPercent(2.99, 35.88)).toBeNull();
  });

  it("says nothing when the annual costs more", () => {
    expect(annualSavingPercent(2.99, 40)).toBeNull();
  });

  it("refuses a missing or zero monthly price", () => {
    expect(annualSavingPercent(0, 19.99)).toBeNull();
    expect(annualSavingPercent(-1, 19.99)).toBeNull();
  });

  it("refuses a missing or zero annual price", () => {
    expect(annualSavingPercent(2.99, 0)).toBeNull();
    expect(annualSavingPercent(2.99, -1)).toBeNull();
  });

  it("refuses NaN, which `<= 0` would have let through", () => {
    expect(annualSavingPercent(NaN, 19.99)).toBeNull();
    expect(annualSavingPercent(2.99, NaN)).toBeNull();
  });

  it("rounds to a whole percent", () => {
    // 1 - 21/36 = 41.66…%
    expect(annualSavingPercent(3, 21)).toBe(42);
  });
});
