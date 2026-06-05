export type StorageKeyValuePair = [string, string | null];

/**
 * Minimal async key/value interface shared by the timer and blinds storage.
 * The mobile app implements it with AsyncStorage; the web app with localStorage.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiGet(keys: string[]): Promise<StorageKeyValuePair[]>;
  multiSet(pairs: [string, string][]): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}
