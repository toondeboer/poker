import { describe, it, expect } from "vitest";
import { formatBlindLevel, formatBlindRange } from "./formatBlinds";

describe("formatBlindLevel", () => {
  it("renders small/big", () => {
    expect(formatBlindLevel({ small: 25, big: 50 })).toBe("25/50");
  });
});

describe("formatBlindRange", () => {
  it("renders first → last", () => {
    expect(
      formatBlindRange([
        { small: 5, big: 10 },
        { small: 10, big: 20 },
        { small: 800, big: 1600 },
      ]),
    ).toBe("5/10 → 800/1600");
  });

  it("renders a single level on its own", () => {
    expect(formatBlindRange([{ small: 5, big: 10 }])).toBe("5/10");
  });

  it("renders an em dash for an empty schedule", () => {
    expect(formatBlindRange([])).toBe("—");
  });
});
