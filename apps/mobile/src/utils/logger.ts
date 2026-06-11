// src/utils/logger.ts
//
// Thin wrapper around `console` that no-ops in production. React Native's
// `__DEV__` global is `true` in dev builds and `false` in release builds, so
// gating here keeps diagnostic logging out of shipped apps without sprinkling
// `if (__DEV__)` at every call site. Import this instead of using `console`
// directly in app code.

type LogMethod = (...args: unknown[]) => void;

const noop: LogMethod = () => {};

export const logger: {
  log: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  debug: LogMethod;
} = __DEV__
  ? {
      log: (...args) => console.log(...args),
      info: (...args) => console.info(...args),
      warn: (...args) => console.warn(...args),
      error: (...args) => console.error(...args),
      debug: (...args) => console.debug(...args),
    }
  : {
      log: noop,
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
    };
