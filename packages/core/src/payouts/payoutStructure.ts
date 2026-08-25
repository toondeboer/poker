/**
 * Prize-pool and payout maths for a home tournament: a buy-in, an optional
 * bounty, and a field size in, a table of "place N wins X" out.
 *
 * **Everything here is integer money.** Amounts are whole units of whatever
 * currency the host is using — the app renders a symbol, this file never sees
 * one. Splitting a pool with floating point is how a payout table ends up
 * summing to 199.99 instead of 200, so the only division that happens is
 * followed immediately by a floor and a remainder pass (see
 * {@link computePayouts}).
 *
 * The feature is Pro-gated in the app, not here — these are pure functions and
 * gate nothing.
 */

/** A single paid finishing position. */
export type Payout = {
  /** 1 = winner, 2 = runner-up, … */
  place: number;
  /** Whole currency units awarded to this place. */
  amount: number;
};

export type PayoutStructure = {
  /**
   * Buy-ins sold: `entrants + rebuys`. A rebuy is another buy-in, so it feeds
   * the pool and the bounties exactly like the first one — but it is **not**
   * another player, which is why {@link defaultPaidPlaces} keys off `entrants`
   * alone. Thirteen players with five rebuys is still thirteen people to pay.
   */
  totalEntries: number;
  /** Add-on money: `addOns × addOnPrice`. All of it funds the prize pool. */
  addOnPool: number;
  /** Total collected: `totalEntries × buyIn + addOnPool`. */
  totalCollected: number;
  /**
   * The part of the take that funds the placed payouts, after bounties are
   * carved out: `totalEntries × (buyIn − bounty) + addOnPool`.
   */
  prizePool: number;
  /** The part of the take paid out per knockout: `totalEntries × bounty`. */
  bountyPool: number;
  /** Paid per elimination, flat. 0 when the tournament has no bounty. */
  bountyPerKnockout: number;
  /** One entry per paid place, descending by amount. Sums exactly to `prizePool`. */
  payouts: Payout[];
};

export type PayoutOptions = {
  /** Whole currency units each player puts in. */
  buyIn: number;
  /** How many players bought in. Drives the paid-place count. */
  entrants: number;
  /**
   * How many times players bought back in after busting. Each costs `buyIn`
   * and splits exactly like one — including re-arming that player's bounty,
   * which is what a rebuy means in a bounty tournament. Defaults to 0.
   */
  rebuys?: number;
  /** How many add-ons were bought. Defaults to 0. */
  addOns?: number;
  /**
   * What one add-on costs. **All of it goes to the prize pool** — an add-on
   * buys chips, not a new bounty, so unlike a buy-in nothing is carved out of
   * it. Ignored when `addOns` is 0.
   */
  addOnPrice?: number;
  /**
   * Whole units of each buy-in that fund knockout bounties instead of the
   * prize pool. Defaults to 0. Must be less than `buyIn` — see
   * {@link validatePayoutOptions}.
   */
  bounty?: number;
  /**
   * Override the number of paid places. Defaults to
   * {@link defaultPaidPlaces} for the field size, and is clamped to
   * `[1, min(entrants, MAX_PAID_PLACES)]`.
   */
  paidPlaces?: number;
  /**
   * Round every payout to a multiple of this. Defaults to 1 (exact units).
   * A table paying 5s and 10s is easier to settle in cash than one paying 37.
   */
  denomination?: number;
};

/**
 * Standard splits by number of paid places, as percentages summing to 100.
 *
 * These are a *curated table*, not a formula, for two reasons: they're the
 * numbers home players already recognise from casino sheets, and a formula
 * produces splits nobody would ever agree to out loud (a smooth curve wants
 * 47.3 / 28.1 / …). Being a table also makes them trivially assertable.
 *
 * The two-place split is **70/30 deliberately** — it's what the website's
 * tournament guide already recommends, and the app contradicting its own
 * marketing copy would be worse than any argument for 65/35.
 */
export const PAYOUT_SPLITS: readonly (readonly number[])[] = [
  [100],
  [70, 30],
  [50, 30, 20],
  [40, 30, 20, 10],
  [35, 25, 18, 12, 10],
  [30, 23, 17, 13, 10, 7],
];

/** Most places this calculator will pay. Beyond six a home game is splitting hairs. */
export const MAX_PAID_PLACES = PAYOUT_SPLITS.length;

/**
 * Field sizes at which another place starts getting paid: the *minimum*
 * entrants for 1, 2, 3, … paid places. Works out to roughly the top 20–25% of
 * the field, which is the home-game convention (casinos pay ~10–15%, but a
 * nine-player kitchen-table game paying only the winner is how you lose
 * players).
 */
const MIN_ENTRANTS_FOR_PLACES: readonly number[] = [1, 5, 8, 13, 18, 25];

/**
 * How many places a field of this size should pay, before any host override.
 * Never pays more places than there are players.
 */
export const defaultPaidPlaces = (entrants: number): number => {
  const field = Math.max(0, Math.floor(sanitize(entrants, 0)));
  if (field <= 0) return 0;
  let places = 1;
  for (let i = 0; i < MIN_ENTRANTS_FOR_PLACES.length; i += 1) {
    if (field >= MIN_ENTRANTS_FOR_PLACES[i]) places = i + 1;
  }
  return Math.min(places, field, MAX_PAID_PLACES);
};

/** Reasons a set of options can't produce a payout table. */
export type PayoutValidationError =
  | "buy-in-not-positive"
  | "no-entrants"
  | "bounty-negative"
  | "bounty-not-below-buy-in"
  | "rebuys-negative"
  | "add-ons-negative"
  | "add-on-price-not-positive";

/**
 * Check options before computing. The app uses this to disable its generate
 * action and say why, so every failure mode is a distinct value rather than a
 * boolean.
 *
 * `bounty === buyIn` is rejected rather than allowed as a zero prize pool: a
 * tournament where every penny is a bounty pays nothing for winning, which is
 * a configuration mistake far more often than an intent.
 *
 * **Validates the floored values, exactly as {@link computePayouts} uses
 * them.** Checking the raw input instead lets `buyIn: 1.5, bounty: 1.2` pass —
 * 1.2 really is less than 1.5 — and then both floor to 1, so the "valid" setup
 * computes a prize pool of nothing. The two have to agree on the same integers
 * or the UI enables a button that produces an all-zero table.
 */
export const validatePayoutOptions = (
  options: PayoutOptions,
): PayoutValidationError | null => {
  const buyIn = Math.floor(sanitize(options.buyIn, 0));
  const entrants = Math.floor(sanitize(options.entrants, 0));
  const bounty = Math.floor(sanitize(options.bounty ?? 0, 0));

  if (buyIn <= 0) return "buy-in-not-positive";
  if (entrants < 1) return "no-entrants";
  if (bounty < 0) return "bounty-negative";
  if (bounty >= buyIn) return "bounty-not-below-buy-in";

  const rebuys = Math.floor(sanitize(options.rebuys ?? 0, 0));
  const addOns = Math.floor(sanitize(options.addOns ?? 0, 0));
  const addOnPrice = Math.floor(sanitize(options.addOnPrice ?? 0, 0));
  if (rebuys < 0) return "rebuys-negative";
  if (addOns < 0) return "add-ons-negative";
  // Only a problem once add-ons are actually being sold; a price sitting at 0
  // with no add-ons is just an unused field.
  if (addOns > 0 && addOnPrice <= 0) return "add-on-price-not-positive";
  return null;
};

/**
 * A suggested bounty for a given buy-in: a fifth of it, snapped down to
 * something payable and never zero for a buy-in that can carry one.
 *
 * The *model* stores a flat amount, because a bounty is physically handed over
 * in cash the moment someone busts and a percentage that computes to 7.40 is
 * unpayable. This exists so the UI can still offer a sensible starting number
 * instead of making the host do the arithmetic.
 */
export const suggestedBounty = (buyIn: number): number => {
  const amount = sanitize(buyIn, 0);
  if (amount < 2) return 0;
  const fifth = Math.floor(amount / 5);
  if (fifth < 1) return 1;
  // Snap to a round-ish number so the default doesn't read as computed.
  const step = fifth >= 20 ? 10 : fifth >= 10 ? 5 : 1;
  return Math.max(1, Math.floor(fifth / step) * step);
};

/**
 * Build the payout table.
 *
 * Bounty money comes **out of** each buy-in, never on top of it: a 20 buy-in
 * with a 5 bounty is still 20 out of each player's pocket, split into 15 of
 * prize pool and 5 of bounty. The alternative — bounties added on top — means
 * the host collects more than the buy-in they advertised, which contradicts
 * the premise of setting a buy-in at all.
 *
 * Bounties are **flat and untracked**. The app states "each knockout pays 5"
 * and the players settle it between themselves as it happens; nothing here
 * knows who eliminated whom. Progressive/knockout bounties would need live
 * elimination tracking, which is a different and much larger feature.
 *
 * **Rounding uses the largest-remainder method.** Each place's ideal share is
 * floored to `denomination`, then the leftover is handed out one denomination
 * at a time to whichever places lost the most to that floor, ties going to the
 * higher finish. That guarantees the invariant this whole file exists for:
 * `payouts` sums to `prizePool` exactly, for every input. Handing the whole
 * remainder to first place instead would be simpler and would quietly hand the
 * winner an extra 4 on a 3-way split of 100.
 *
 * **`payouts.length` is authoritative, and can be fewer than asked for**, when
 * the pool can't fund the requested places at the chosen denomination. Callers
 * should render that number rather than the count they passed in.
 *
 * Returns `null` when {@link validatePayoutOptions} rejects the options.
 */
export const computePayouts = (
  options: PayoutOptions,
): PayoutStructure | null => {
  if (validatePayoutOptions(options) !== null) return null;

  const buyIn = Math.floor(sanitize(options.buyIn, 0));
  const entrants = Math.floor(sanitize(options.entrants, 0));
  const bounty = Math.floor(sanitize(options.bounty ?? 0, 0));
  const denomination = Math.max(
    1,
    Math.floor(sanitize(options.denomination ?? 1, 1)),
  );

  const rebuys = Math.floor(sanitize(options.rebuys ?? 0, 0));
  const addOns = Math.floor(sanitize(options.addOns ?? 0, 0));
  const addOnPrice = Math.floor(sanitize(options.addOnPrice ?? 0, 0));

  const totalEntries = entrants + rebuys;
  const addOnPool = addOns * addOnPrice;
  const totalCollected = buyIn * totalEntries + addOnPool;
  const bountyPool = bounty * totalEntries;
  const prizePool = totalCollected - bountyPool;

  const requested = options.paidPlaces ?? defaultPaidPlaces(entrants);
  const paidPlaces = clamp(
    Math.floor(sanitize(requested, 1)),
    1,
    Math.min(entrants, MAX_PAID_PLACES),
  );

  // Pay one place fewer until every paid place actually wins something.
  //
  // The place count comes from the field size, which knows nothing about
  // whether the pool can fund it at the chosen denomination. A 5 buy-in with a
  // 1 bounty across 13 players is a 52 pool, and rounding to 10s that splits
  // four ways as 22/20/10/**0** — a fourth place, announced as paid, winning
  // nothing. Summing to the pool is not enough on its own: handing someone 0
  // satisfies that invariant perfectly.
  //
  // Reducing terminates: one place always pays the whole pool, and the pool is
  // at least 1 because validation rejects a bounty at or above the buy-in.
  let places = paidPlaces;
  let amounts = distribute(prizePool, PAYOUT_SPLITS[places - 1], denomination);
  while (places > 1 && amounts.some((amount) => amount <= 0)) {
    places -= 1;
    amounts = distribute(prizePool, PAYOUT_SPLITS[places - 1], denomination);
  }

  return {
    totalEntries,
    addOnPool,
    totalCollected,
    prizePool,
    bountyPool,
    bountyPerKnockout: bounty,
    payouts: amounts.map((amount, index) => ({ place: index + 1, amount })),
  };
};

/**
 * Split `pool` across `weights` in multiples of `denomination`, using the
 * largest-remainder method so the result sums to `pool` exactly.
 *
 * The weights are relative, not absolute: the payout splits pass percentages
 * that happen to total 100, and the chop calculator passes chip stacks. Callers
 * must pass a positive total and a pool of at least 1 — both are checked by
 * their own validation before they get here.
 *
 * When the pool isn't a whole number of denominations the leftover can't be
 * expressed in the chosen units at all. It's kept rather than dropped — money
 * that vanishes from a payout table is a bug the host discovers with cash in
 * hand — and it goes to the **largest weight**, not to index 0.
 *
 * That distinction only shows up in the chop. For a payout table the weights
 * are non-increasing, so the largest is index 0 and this is exactly the old
 * "give it to first place" rule. For a chop the weights are chip stacks in
 * whatever order they were typed, and index 0 meant *whoever was entered
 * first*: two identical 1-chip stacks came out 10 apart, and a 1-chip stack
 * typed first beat a 1000-chip stack. Keying on the weight makes the result
 * depend on the stacks rather than on data entry.
 */
export const distribute = (
  pool: number,
  weights: readonly number[],
  denomination: number,
): number[] => {
  // `pool` is always ≥ 1 here: validation floors the same values this uses and
  // rejects `bounty >= buyIn`, so `entrants × (buyIn − bounty)` can't reach 0.
  const units = Math.floor(pool / denomination);
  const indivisible = pool - units * denomination;

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const ideal = weights.map((weight) => (units * weight) / totalWeight);
  const floors = ideal.map(Math.floor);
  let remaining = units - floors.reduce((sum, value) => sum + value, 0);

  // Largest fractional part first; a tie goes to the better finish, which is
  // why the index comparison is part of the sort rather than left to chance.
  const order = ideal
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) =>
      b.fraction === a.fraction ? a.index - b.index : b.fraction - a.fraction,
    );

  for (const { index } of order) {
    if (remaining <= 0) break;
    floors[index] += 1;
    remaining -= 1;
  }

  const amounts = floors.map((value) => value * denomination);

  let heaviest = 0;
  for (let i = 1; i < weights.length; i += 1) {
    if (weights[i] > weights[heaviest]) heaviest = i;
  }
  amounts[heaviest] += indivisible;
  return amounts;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const sanitize = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

/**
 * A finishing position as an English ordinal: 1 → "1st", 22 → "22nd".
 *
 * Lives here rather than in the app because it's pure and therefore testable,
 * and because both apps would otherwise write their own. English-only, like
 * `SHARE_MESSAGE` — the app is not localised.
 */
export const formatPlace = (place: number): string => {
  const n = Math.floor(sanitize(place, 0));
  const lastTwo = Math.abs(n) % 100;
  const lastOne = Math.abs(n) % 10;
  // 11th, 12th and 13th break the pattern the last digit would otherwise set.
  const suffix =
    lastTwo >= 11 && lastTwo <= 13
      ? "th"
      : lastOne === 1
        ? "st"
        : lastOne === 2
          ? "nd"
          : lastOne === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
};
