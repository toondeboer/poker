/** Bounds for a round's length, enforced wherever a duration is edited. */
export const MIN_ROUND_DURATION_SECONDS = 10;
export const MAX_ROUND_DURATION_SECONDS = 180 * 60;

/** Clamp a round duration into the supported range, rounding to whole seconds. */
export const clampRoundDuration = (seconds: number): number => {
  if (!Number.isFinite(seconds)) return MIN_ROUND_DURATION_SECONDS;
  return Math.max(
    MIN_ROUND_DURATION_SECONDS,
    Math.min(MAX_ROUND_DURATION_SECONDS, Math.round(seconds)),
  );
};

/**
 * Split a stored duration into the minutes/seconds a two-field editor shows.
 * Deliberately does not clamp — it must faithfully display whatever is stored.
 */
export const splitDuration = (
  totalSeconds: number,
): { minutes: number; seconds: number } => {
  const safe =
    Number.isFinite(totalSeconds) && totalSeconds > 0
      ? Math.round(totalSeconds)
      : 0;
  return { minutes: Math.floor(safe / 60), seconds: safe % 60 };
};

/** Recombine a minutes/seconds pair into a clamped duration in seconds. */
export const joinDuration = (minutes: number, seconds: number): number => {
  const wholeMinutes =
    Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes) : 0;
  const wholeSeconds =
    Number.isFinite(seconds) && seconds > 0
      ? Math.min(59, Math.floor(seconds))
      : 0;
  return clampRoundDuration(wholeMinutes * 60 + wholeSeconds);
};
