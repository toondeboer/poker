import { describe, it, expect } from "vitest";
import {
  createPayoutStorage,
  toPayoutOptions,
  DEFAULT_PAYOUT_SETTINGS,
  PayoutSettings,
} from "./payoutStorage";
import { createFailingAdapter, createMemoryAdapter } from "./testAdapters";
import { computePayouts } from "../payouts/payoutStructure";

const SETTINGS: PayoutSettings = {
  buyIn: 30,
  entrants: 12,
  rebuys: 4,
  addOns: 3,
  addOnPrice: 15,
  bounty: 5,
  bountyMode: "progressive",
  paidPlaces: 4,
  denomination: 10,
};

describe("createPayoutStorage", () => {
  it("defaults when nothing is stored", async () => {
    const storage = createPayoutStorage(createMemoryAdapter());
    expect(await storage.loadPayoutSettings()).toEqual(DEFAULT_PAYOUT_SETTINGS);
  });

  it("round-trips a full settings object", async () => {
    const storage = createPayoutStorage(createMemoryAdapter());
    await storage.savePayoutSettings(SETTINGS);
    expect(await storage.loadPayoutSettings()).toEqual(SETTINGS);
  });

  it("round-trips a null paidPlaces as null, not as a number", async () => {
    // null means "follow the default for whatever field turns up", which is a
    // different instruction from any specific count.
    const storage = createPayoutStorage(createMemoryAdapter());
    await storage.savePayoutSettings({ ...SETTINGS, paidPlaces: null });
    expect((await storage.loadPayoutSettings()).paidPlaces).toBeNull();
  });

  it("clears back to defaults", async () => {
    const adapter = createMemoryAdapter();
    const storage = createPayoutStorage(adapter);
    await storage.savePayoutSettings(SETTINGS);
    await storage.clearPayoutSettings();
    expect(adapter.store.has("payout_settings")).toBe(false);
    expect(await storage.loadPayoutSettings()).toEqual(DEFAULT_PAYOUT_SETTINGS);
  });

  it("falls back to defaults when the stored value is not JSON", async () => {
    const storage = createPayoutStorage(
      createMemoryAdapter({ payout_settings: "{not json" }),
    );
    expect(await storage.loadPayoutSettings()).toEqual(DEFAULT_PAYOUT_SETTINGS);
  });

  it("falls back to defaults when the stored value is JSON but not an object", async () => {
    for (const raw of ["null", '"twenty"', "42", "[1,2,3]"]) {
      const storage = createPayoutStorage(
        createMemoryAdapter({ payout_settings: raw }),
      );
      const loaded = await storage.loadPayoutSettings();
      // An array is an object, so it coerces field-by-field to defaults rather
      // than being rejected outright — either way nothing bogus survives.
      expect(loaded.buyIn).toBe(DEFAULT_PAYOUT_SETTINGS.buyIn);
      expect(loaded.entrants).toBe(DEFAULT_PAYOUT_SETTINGS.entrants);
    }
  });

  it("keeps the readable fields when a partial write loses the rest", async () => {
    // The realistic route is a settings object that gained a field in a later
    // version, then got read back by an older build — or a write interrupted
    // mid-flight. Resetting everything would throw away a buy-in the host set.
    const storage = createPayoutStorage(
      createMemoryAdapter({ payout_settings: JSON.stringify({ buyIn: 50 }) }),
    );
    const loaded = await storage.loadPayoutSettings();
    expect(loaded.buyIn).toBe(50);
    expect(loaded.entrants).toBe(DEFAULT_PAYOUT_SETTINGS.entrants);
    expect(loaded.denomination).toBe(DEFAULT_PAYOUT_SETTINGS.denomination);
    expect(loaded.paidPlaces).toBeNull();
  });

  it("rejects non-numeric and non-finite field values", async () => {
    // Written as raw JSON rather than via JSON.stringify: `1e999` parses to
    // Infinity, and that exponent is exactly what a stored file can contain
    // even though no literal in this repo may spell it.
    const storage = createPayoutStorage(
      createMemoryAdapter({
        payout_settings:
          '{"buyIn":"50","entrants":null,"bounty":{},"denomination":1e999,"paidPlaces":"three"}',
      }),
    );
    expect(await storage.loadPayoutSettings()).toEqual(DEFAULT_PAYOUT_SETTINGS);
  });

  it("falls back to defaults when storage throws", async () => {
    const storage = createPayoutStorage(createFailingAdapter());
    expect(await storage.loadPayoutSettings()).toEqual(DEFAULT_PAYOUT_SETTINGS);
  });
});

describe("toPayoutOptions", () => {
  it("maps a null paidPlaces to undefined so the default place count applies", () => {
    const options = toPayoutOptions({ ...SETTINGS, paidPlaces: null });
    expect(options.paidPlaces).toBeUndefined();
  });

  it("passes an explicit paidPlaces straight through", () => {
    expect(toPayoutOptions(SETTINGS).paidPlaces).toBe(4);
  });

  it("produces options the calculator accepts", () => {
    const result = computePayouts(toPayoutOptions(SETTINGS));
    expect(result).not.toBeNull();
    expect(result!.payouts).toHaveLength(4);
  });

  it("loads settings saved before rebuys existed, at their defaults", async () => {
    // The realistic route: a 1.1.4 user's stored settings, read by 1.1.5.
    // Field-by-field coercion is what makes this a non-event.
    const storage = createPayoutStorage(
      createMemoryAdapter({
        payout_settings: JSON.stringify({
          buyIn: 50,
          entrants: 9,
          bounty: 10,
          paidPlaces: null,
          denomination: 5,
        }),
      }),
    );
    const loaded = await storage.loadPayoutSettings();
    expect(loaded.buyIn).toBe(50);
    expect(loaded.rebuys).toBe(0);
    expect(loaded.addOns).toBe(0);
    expect(loaded.addOnPrice).toBe(DEFAULT_PAYOUT_SETTINGS.addOnPrice);
    expect(computePayouts(toPayoutOptions(loaded))).not.toBeNull();
  });

  it("carries rebuys and add-ons through to the calculator", () => {
    const result = computePayouts(toPayoutOptions(SETTINGS));
    expect(result).not.toBeNull();
    expect(result!.totalEntries).toBe(16);
    expect(result!.addOnPool).toBe(45);
  });

  it("produces a usable table from the shipped defaults", () => {
    const result = computePayouts(toPayoutOptions(DEFAULT_PAYOUT_SETTINGS));
    expect(result).not.toBeNull();
    expect(result!.prizePool).toBe(160);
  });
});

describe("the bounty mode", () => {
  it("defaults to flat for settings saved before it existed", async () => {
    // Field-by-field coercion, so there is no migration — but the *direction*
    // matters: flat pays exactly what the screen says it pays.
    const adapter = createMemoryAdapter({
      payout_settings: JSON.stringify({ buyIn: 20, bounty: 5 }),
    });
    const loaded = await createPayoutStorage(adapter).loadPayoutSettings();
    expect(loaded.bountyMode).toBe("flat");
  });

  it("reads anything it does not recognise as flat", async () => {
    const failures: string[] = [];
    for (const stored of ["progressiv", "FLAT", 3, null, {}]) {
      const adapter = createMemoryAdapter({
        payout_settings: JSON.stringify({ bountyMode: stored }),
      });
      const loaded = await createPayoutStorage(adapter).loadPayoutSettings();
      if (loaded.bountyMode !== "flat") failures.push(JSON.stringify(stored));
    }
    expect(failures).toEqual([]);
  });

  it("carries through to the options the calculator reads", async () => {
    const settings = await createPayoutStorage(
      createMemoryAdapter({
        payout_settings: JSON.stringify({ bountyMode: "progressive" }),
      }),
    ).loadPayoutSettings();
    expect(toPayoutOptions(settings).bountyMode).toBe("progressive");
  });
});
