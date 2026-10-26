import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from './storage';

/** AsyncStorage-backed store (localStorage on web). Failures degrade to "nothing remembered". */
export const asyncStorageStore: KeyValueStore = {
  async get(k) {
    try { return await AsyncStorage.getItem(k); } catch { return null; }
  },
  async set(k, v) {
    try { await AsyncStorage.setItem(k, v); } catch { /* storage unavailable (private mode) */ }
  },
  async remove(k) {
    try { await AsyncStorage.removeItem(k); } catch { /* ignore */ }
  },
};
