import * as Location from 'expo-location';
import type { LocationPort } from './AppContext';

/** Approximate, foreground-only location. Never requests background location. */
export const expoLocation: LocationPort = {
  async requestApproximate() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return { status: 'denied' };
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      return { status: 'granted', latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      return { status: 'unavailable' };
    }
  },
};
