// src/services/storageAdapter.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorageAdapter, StorageKeyValuePair } from "@poker/core";

/** A {@link StorageAdapter} backed by React Native AsyncStorage. */
export const asyncStorageAdapter: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  multiGet: async (keys) => {
    const result = await AsyncStorage.multiGet(keys);
    return result.map(([key, value]) => [key, value] as StorageKeyValuePair);
  },
  multiSet: (pairs) => AsyncStorage.multiSet(pairs),
  multiRemove: (keys) => AsyncStorage.multiRemove(keys),
};
