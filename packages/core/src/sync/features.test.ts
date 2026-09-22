import { describe, expect, it } from "vitest";
import { NO_FEATURES, readFeatures } from "./features";

describe("what the server says the app may do", () => {
  it("reads both flags", () => {
    expect(readFeatures({ accounts: true, sharing: true })).toEqual({
      accounts: true,
      sharing: true,
    });
    expect(readFeatures({ accounts: true, sharing: false })).toEqual({
      accounts: true,
      sharing: false,
    });
  });
});

describe("what happens when the answer is not an answer", () => {
  it("is off, which is the whole point of the switch", () => {
    // **A backend that cannot be reached is one where none of this works
    // anyway**, so refusing early turns a queue of failing requests into a
    // feature that is simply absent. The other way round has the app queueing
    // writes at a server that is not there and calling it syncing.
    expect(readFeatures(null)).toEqual(NO_FEATURES);
    expect(readFeatures(undefined)).toEqual(NO_FEATURES);
    expect(readFeatures("nonsense")).toEqual(NO_FEATURES);
    expect(readFeatures([])).toEqual(NO_FEATURES);
  });

  it("does not treat a missing flag as permission", () => {
    // A version mismatch, or a response that is not ours. Neither is a reason
    // to assume yes.
    expect(readFeatures({ accounts: true })).toEqual({
      accounts: true,
      sharing: false,
    });
    expect(readFeatures({})).toEqual(NO_FEATURES);
  });

  it("wants an actual boolean, not something truthy", () => {
    // A proxy or an error page answering `"true"` is not the server agreeing.
    expect(readFeatures({ accounts: "true", sharing: 1 })).toEqual(NO_FEATURES);
  });

  it("cannot be switched on by mutating the default", () => {
    // It is handed to callers on every failure; one in-place write would turn
    // the switch on for the rest of the process.
    expect(Object.isFrozen(NO_FEATURES)).toBe(true);
  });
});
