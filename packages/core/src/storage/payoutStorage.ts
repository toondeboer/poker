import { StorageAdapter } from "./StorageAdapter";
import { PayoutOptions } from "../payouts/payoutStructure";

const STORAGE_KEY = "payout_settings";

/**
 * The host's last-used payout setup, remembered so a regular game night isn't
 * retyped every week.
 *
 * `paidPlaces` is `null` when the host hasn't overridden it — that's
 * meaningfully different from any number, because it means "track the default
 * for whatever field turns up", and a group whose numbers vary week to week
 * wants that rather than a frozen count.
 */
export type PayoutSettings = {
  buyIn: number;
  entrants: number;
  bounty: number;
  paidPlaces: number | null;
  denomination: number;
};

export const DEFAULT_PAYOUT_SETTINGS: PayoutSettings = {
  buyIn: 20,
  entrants: 8,
  bounty: 0,
  paidPlaces: null,
  denomination: 5,
};

export interface PayoutStorage {
  loadPayoutSettings(): Promise<PayoutSettings>;
  savePayoutSettings(settings: PayoutSettings): Promise<void>;
  clearPayoutSettings(): Promise<void>;
}

/** Turn stored settings into options {@link computePayouts} accepts. */
export const toPayoutOptions = (settings: PayoutSettings): PayoutOptions => ({
  buyIn: settings.buyIn,
  entrants: settings.entrants,
  bounty: settings.bounty,
  paidPlaces: settings.paidPlaces ?? undefined,
  denomination: settings.denomination,
});

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * Field-by-field rather than trusting the parsed blob wholesale: a settings
 * object that gained a field in a later version, or lost one to a partial
 * write, should come back with the rest intact instead of resetting the lot to
 * defaults.
 */
const coerce = (raw: unknown): PayoutSettings => {
  if (typeof raw !== "object" || raw === null) {
    return { ...DEFAULT_PAYOUT_SETTINGS };
  }
  const value = raw as Record<string, unknown>;
  const paidPlaces = value.paidPlaces;
  return {
    buyIn: numberOr(value.buyIn, DEFAULT_PAYOUT_SETTINGS.buyIn),
    entrants: numberOr(value.entrants, DEFAULT_PAYOUT_SETTINGS.entrants),
    bounty: numberOr(value.bounty, DEFAULT_PAYOUT_SETTINGS.bounty),
    paidPlaces:
      typeof paidPlaces === "number" && Number.isFinite(paidPlaces)
        ? paidPlaces
        : null,
    denomination: numberOr(
      value.denomination,
      DEFAULT_PAYOUT_SETTINGS.denomination,
    ),
  };
};

/**
 * Create a payout-settings store backed by any {@link StorageAdapter}. Falls
 * back to {@link DEFAULT_PAYOUT_SETTINGS} on a missing, corrupt or unavailable
 * value. Pure persistence/serialization — no platform or UI deps.
 */
export function createPayoutStorage(storage: StorageAdapter): PayoutStorage {
  return {
    async loadPayoutSettings(): Promise<PayoutSettings> {
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_PAYOUT_SETTINGS };
        return coerce(JSON.parse(raw));
      } catch {
        return { ...DEFAULT_PAYOUT_SETTINGS };
      }
    },

    async savePayoutSettings(settings: PayoutSettings): Promise<void> {
      await storage.setItem(STORAGE_KEY, JSON.stringify(settings));
    },

    async clearPayoutSettings(): Promise<void> {
      await storage.multiRemove([STORAGE_KEY]);
    },
  };
}
