// src/utils/id.ts

/**
 * Short, collision-resistant id.
 *
 * Lives in the app rather than in `@poker/core`, which has no clock and no
 * crypto by design — every core function that needs an id takes one.
 */
export const generateId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
