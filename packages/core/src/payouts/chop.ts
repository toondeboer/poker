import { distribute, PayoutStructure } from "./payoutStructure";

/**
 * Splitting the remaining prize money when the players still in agree to end
 * it there — the calculation everyone reaches for their phone to do at 1am.
 *
 * **Every remaining player is guaranteed the lowest prize still live, and only
 * the surplus above that is split by chip stack.** A purely chip-proportional
 * split is the obvious implementation and it is wrong: a short stack can come
 * out below the place they had already locked up, which no table would agree
 * to. Guaranteeing the floor first is what real deals do, and it's explainable
 * in one sentence, which matters when five tired people have to accept it.
 *
 * The chop is only defined while everyone left is in the money. Above that,
 * players outside the paid places would be taking money that isn't theirs, and
 * the honest answer is to keep playing — see {@link validateChop}.
 */
export type ChopShare = {
  /** Position in the `chips` array as given, so callers can pair it back up. */
  index: number;
  chips: number;
  /** What this player takes: the guarantee plus their share of the surplus. */
  amount: number;
};

export type ChopResult = {
  /** The prizes still undecided — the top `chips.length` places. */
  remainingMoney: number;
  /** The lowest live prize, which nobody ends up below. */
  guaranteedEach: number;
  /** What's left once everyone has their guarantee; split by chips. */
  surplus: number;
  /** One per remaining player, in the order the chips were given. */
  shares: ChopShare[];
};

export type ChopOptions = {
  structure: PayoutStructure;
  /** Chip stack per remaining player. Two or more, at least one non-zero. */
  chips: number[];
  /** Round each share to a multiple of this, as the payout table does. */
  denomination?: number;
};

export type ChopValidationError =
  | "too-few-players"
  | "more-players-than-places"
  | "negative-chips"
  | "no-chips";

export const validateChop = (
  options: ChopOptions,
): ChopValidationError | null => {
  const { structure, chips } = options;

  if (chips.length < 2) return "too-few-players";
  // Beyond this the deal would be handing money to players who haven't reached
  // the paid places yet.
  if (chips.length > structure.payouts.length) {
    return "more-players-than-places";
  }
  if (chips.some((stack) => !Number.isFinite(stack) || stack < 0)) {
    return "negative-chips";
  }
  if (chips.reduce((total, stack) => total + stack, 0) <= 0) return "no-chips";

  return null;
};

/**
 * Work out the deal. Returns `null` when {@link validateChop} rejects it.
 *
 * The shares sum to `remainingMoney` exactly, for the same reason the payout
 * table sums to the prize pool: the surplus goes through the same
 * largest-remainder rounding, with chip stacks as the weights instead of the
 * split percentages.
 */
export const computeChop = (options: ChopOptions): ChopResult | null => {
  if (validateChop(options) !== null) return null;

  const { structure, chips } = options;
  const denomination = Math.max(
    1,
    Math.floor(
      Number.isFinite(options.denomination ?? 1) ? (options.denomination ?? 1) : 1,
    ),
  );

  const live = structure.payouts.slice(0, chips.length);
  const remainingMoney = live.reduce((total, payout) => total + payout.amount, 0);
  // Payouts are non-increasing, so the last live place is the smallest.
  const guaranteedEach = live[live.length - 1].amount;
  const surplus = remainingMoney - guaranteedEach * chips.length;

  // Zero when every live place pays the same, which a flat split can produce.
  // `distribute` requires a pool of at least 1, so it isn't called at all here.
  const extra =
    surplus > 0 ? distribute(surplus, chips, denomination) : chips.map(() => 0);

  return {
    remainingMoney,
    guaranteedEach,
    surplus,
    shares: chips.map((stack, index) => ({
      index,
      chips: stack,
      amount: guaranteedEach + extra[index],
    })),
  };
};
