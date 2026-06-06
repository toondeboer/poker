import type { StorageAdapter, StorageKeyValuePair } from "@poker/core";

const hasStorage = (): boolean =>
  typeof window !== "undefined" && !!window.localStorage;

/** A {@link StorageAdapter} backed by the browser's localStorage (SSR-safe). */
export const localStorageAdapter: StorageAdapter = {
  async getItem(key) {
    return hasStorage() ? window.localStorage.getItem(key) : null;
  },
  async setItem(key, value) {
    if (hasStorage()) window.localStorage.setItem(key, value);
  },
  async multiGet(keys) {
    return keys.map(
      (key) =>
        [
          key,
          hasStorage() ? window.localStorage.getItem(key) : null,
        ] as StorageKeyValuePair,
    );
  },
  async multiSet(pairs) {
    if (!hasStorage()) return;
    for (const [key, value] of pairs) window.localStorage.setItem(key, value);
  },
  async multiRemove(keys) {
    if (!hasStorage()) return;
    for (const key of keys) window.localStorage.removeItem(key);
  },
};
