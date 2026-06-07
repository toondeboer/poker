import { describe, it, expect } from "vitest";
import { formatTime } from "./format";

describe("formatTime", () => {
  it("zero-pads minutes and seconds as MM:SS", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(5)).toBe("00:05");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(600)).toBe("10:00");
    expect(formatTime(3599)).toBe("59:59");
  });

  it("does not roll minutes over into hours", () => {
    expect(formatTime(3600)).toBe("60:00");
  });
});
