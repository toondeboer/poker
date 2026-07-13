import { BlindLevel } from "../types/BlindLevel";

/**
 * A saved tournament preset — a named blind structure plus its round duration,
 * so a whole setup can be stored and restored in one tap. Framework-agnostic:
 * the app supplies `id` and `now` (no crypto/clock in @poker/core).
 */
export type BlindPreset = {
  id: string;
  name: string;
  blindLevels: BlindLevel[];
  /** Round duration in seconds, paired with the structure. */
  timerDuration: number;
  /** Epoch ms the preset was created (used for newest-first ordering). */
  createdAt: number;
};

/** Cap the list to keep storage small and the UI manageable. */
export const MAX_PRESETS = 20;

export function createPreset(params: {
  id: string;
  name: string;
  blindLevels: BlindLevel[];
  timerDuration: number;
  now: number;
}): BlindPreset {
  return {
    id: params.id,
    name: params.name.trim(),
    blindLevels: params.blindLevels,
    timerDuration: params.timerDuration,
    createdAt: params.now,
  };
}

/** Add a preset (newest first), enforcing {@link MAX_PRESETS}. */
export function addPreset(
  presets: BlindPreset[],
  preset: BlindPreset,
): BlindPreset[] {
  return [preset, ...presets].slice(0, MAX_PRESETS);
}

/** Remove a preset by id, returning a new array. */
export function removePreset(
  presets: BlindPreset[],
  id: string,
): BlindPreset[] {
  return presets.filter((preset) => preset.id !== id);
}

/**
 * A name is usable when it's non-empty and not a case-insensitive duplicate of
 * an existing preset — so the save button can disable on bad input.
 */
export function isValidPresetName(
  name: string,
  presets: BlindPreset[],
): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  return !presets.some(
    (preset) => preset.name.toLowerCase() === trimmed.toLowerCase(),
  );
}
