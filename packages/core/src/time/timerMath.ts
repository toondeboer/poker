/** Seconds remaining until `endTime` (ms epoch), never negative. */
export const calculateTimeLeft = (
  endTime: number,
  now: number = Date.now(),
): number => Math.max(0, Math.ceil((endTime - now) / 1000));

/** The epoch (ms) at which a timer with `timeLeft` seconds left would expire. */
export const computeEndTime = (
  timeLeft: number,
  now: number = Date.now(),
): number => now + timeLeft * 1000;

/** Fraction elapsed in [0, 1] for a round of `duration` seconds with `timeLeft` remaining. */
export const progress = (timeLeft: number, duration: number): number => {
  if (duration <= 0) return 0;
  return Math.min(1, Math.max(0, (duration - timeLeft) / duration));
};
