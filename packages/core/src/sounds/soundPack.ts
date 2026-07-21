/**
 * A selectable alarm sound. Ids double as the filename stem for the bundled
 * asset on every platform (JS require, Android `res/raw/<id>.wav`, iOS
 * `<id>.wav` in the app bundle) — see `useSounds`/`useTimerNotification` in
 * `@poker/mobile` and `PokerTimerService.java`'s dynamic resource lookup.
 */
export type SoundPackId = "alarm" | "classic_beep" | "bell_chime" | "double_buzz";

/** Free default — always available regardless of Pro status. */
export const DEFAULT_SOUND_PACK_ID: SoundPackId = "alarm";

export const SOUND_PACKS: { id: SoundPackId; label: string }[] = [
  { id: "alarm", label: "Classic Alarm" },
  { id: "classic_beep", label: "Classic Beep" },
  { id: "bell_chime", label: "Bell Chime" },
  { id: "double_buzz", label: "Double Buzz" },
];

export function isValidSoundPackId(value: string): value is SoundPackId {
  return SOUND_PACKS.some((pack) => pack.id === value);
}
