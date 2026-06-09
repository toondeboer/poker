// src/services/storageAdapter.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorageAdapter, StorageKeyValuePair } from "@poker/core";

/** A {@link StorageAdapter} backed by React Native AsyncStorage. */
export const asyncStorageAdapter: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  multiGet: async (keys) => {
    const result = await AsyncStorage.getMany(keys);
    return keys.map((key) => [key, result[key] ?? null] as StorageKeyValuePair);
  },
  multiSet: (pairs) => AsyncStorage.setMany(Object.fromEntries(pairs)),
  multiRemove: (keys) => AsyncStorage.removeMany(keys),
};
