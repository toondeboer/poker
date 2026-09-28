import type { StorageAdapter, StorageKeyValuePair } from "./StorageAdapter";

/**
 * An in-memory {@link StorageAdapter}, mirroring the contract both apps
 * implement (AsyncStorage on mobile, localStorage on web).
 *
 * `seed` pre-populates raw stored strings, which is how the "someone else wrote
 * this key" and "the value on disk is corrupt" cases get exercised — those are
 * real states after an app upgrade, and every loader here has a fallback path
 * for them that is otherwise unreachable from a test.
 */
export function createMemoryAdapter(
  seed: Record<string, string> = {},
): StorageAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    store,
    async getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    async setItem(key, value) {
      store.set(key, value);
    },
    async multiGet(keys) {
      return keys.map(
        (key) =>
          [key, store.has(key) ? store.get(key)! : null] as StorageKeyValuePair,
      );
    },
    async multiSet(pairs) {
      for (const [key, value] of pairs) store.set(key, value);
    },
    async multiRemove(keys) {
      for (const key of keys) store.delete(key);
    },
  };
}

/**
 * An adapter whose every operation rejects, standing in for storage being
 * unavailable or the underlying native module failing.
 *
 * This is the only way to reach the `catch` arm of each loader, and those arms
 * are the ones that matter most on a real device: they decide whether a broken
 * read degrades to sane defaults or takes the screen down with it.
 */
export function createFailingAdapter(): StorageAdapter {
  const boom = () => Promise.reject(new Error("storage unavailable"));
  return {
    getItem: boom,
    setItem: boom,
    multiGet: boom,
    multiSet: boom,
    multiRemove: boom,
  };
}
